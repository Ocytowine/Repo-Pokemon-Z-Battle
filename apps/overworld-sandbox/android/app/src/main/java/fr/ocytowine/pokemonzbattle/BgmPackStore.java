package fr.ocytowine.pokemonzbattle;

import android.content.Context;
import android.net.Uri;
import android.system.ErrnoException;
import android.system.Os;
import android.webkit.WebResourceResponse;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Content-addressed BGM overlay. The original APK remains the fallback during the pilot. */
final class BgmPackStore {
    private static final int MAX_OBJECT_BYTES = 16 * 1024 * 1024;
    private static final int MAX_CHUNK_BYTES = 4 * 1024 * 1024;
    private static final String PREFIX = "/__pokemon-z/source/";
    private final File directory;
    private volatile Map<String, Entry> active = Collections.emptyMap();
    private volatile String activeVersion = "";
    private final Set<String> verified = Collections.synchronizedSet(new HashSet<>());

    private static final class Entry {
        final String sha256;
        final long sizeBytes;
        final String mime;
        Entry(String sha256, long sizeBytes, String mime) {
            this.sha256 = sha256; this.sizeBytes = sizeBytes; this.mime = mime;
        }
    }

    BgmPackStore(Context context) {
        directory = new File(context.getFilesDir(), "bgm-pack");
        if (!directory.isDirectory() && !directory.mkdirs()) return;
        try {
            File file = new File(directory, "active.json");
            if (file.isFile()) {
                JSONObject manifest = new JSONObject(new String(readBytes(file, 1024 * 1024), StandardCharsets.UTF_8));
                active = parseManifest(manifest);
                activeVersion = manifest.getString("version");
            }
        } catch (Exception ignored) { active = Collections.emptyMap(); activeVersion = ""; }
    }

    String activeVersion() { return activeVersion; }

    synchronized List<String> missingObjects(String json) throws IOException, JSONException {
        Map<String, Entry> entries = parseManifest(new JSONObject(json));
        List<String> missing = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Entry entry : entries.values()) {
            if (!seen.add(entry.sha256)) continue;
            if (!validObject(entry)) missing.add(entry.sha256);
        }
        return missing;
    }

    synchronized void installChunk(String sha256, long totalBytes, long offset, byte[] bytes) throws IOException {
        if (!validHash(sha256) || totalBytes < 1 || totalBytes > MAX_OBJECT_BYTES
            || offset < 0 || bytes.length < 1 || bytes.length > MAX_CHUNK_BYTES
            || offset + bytes.length > totalBytes) throw new IOException("Morceau BGM invalide.");
        File part = new File(directory, sha256 + ".part");
        try (RandomAccessFile output = new RandomAccessFile(part, "rw")) {
            if (offset == 0) output.setLength(0);
            if (output.length() != offset) throw new IOException("Ordre des morceaux BGM invalide.");
            output.seek(offset);
            output.write(bytes);
            output.getFD().sync();
        }
        if (offset + bytes.length == totalBytes) {
            if (part.length() != totalBytes || !sha256.equals(digest(part))) {
                part.delete();
                throw new IOException("Empreinte BGM incorrecte.");
            }
            atomicRename(part, new File(directory, sha256 + ".bin"));
            verified.add(sha256);
        }
    }

    synchronized int activate(String json) throws IOException, JSONException {
        JSONObject manifest = new JSONObject(json);
        Map<String, Entry> entries = parseManifest(manifest);
        for (Entry entry : entries.values()) {
            if (!validObject(entry)) throw new IOException("Pack BGM incomplet ou corrompu.");
        }
        File temporary = File.createTempFile("active-", ".tmp", directory);
        try {
            try (FileOutputStream output = new FileOutputStream(temporary)) {
                output.write(json.getBytes(StandardCharsets.UTF_8));
                output.getFD().sync();
            }
            atomicRename(temporary, new File(directory, "active.json"));
            active = Collections.unmodifiableMap(entries);
            activeVersion = manifest.getString("version");
        } finally { temporary.delete(); }
        return entries.size();
    }

    WebResourceResponse audioFor(Uri uri, Map<String, String> requestHeaders) {
        if (!"https".equals(uri.getScheme()) || !"localhost".equals(uri.getHost())) return null;
        String requestPath = uri.getPath();
        if (requestPath == null || !requestPath.startsWith(PREFIX)) return null;
        Entry entry = active.get(requestPath.substring(PREFIX.length()));
        if (entry == null) return null;
        try {
            if (!validObject(entry)) return null;
            File file = new File(directory, entry.sha256 + ".bin");
            String rangeHeader = null;
            for (Map.Entry<String, String> header : requestHeaders.entrySet()) {
                if ("range".equalsIgnoreCase(header.getKey())) { rangeHeader = header.getValue(); break; }
            }
            long start = 0;
            long end = entry.sizeBytes - 1;
            boolean partial = rangeHeader != null;
            if (partial) {
                java.util.regex.Matcher match = java.util.regex.Pattern.compile("bytes=(\\d*)-(\\d*)").matcher(rangeHeader);
                if (!match.matches()) return rangeError(entry.sizeBytes);
                if (match.group(1).isEmpty()) {
                    if (match.group(2).isEmpty()) return rangeError(entry.sizeBytes);
                    long suffix = Long.parseLong(match.group(2));
                    if (suffix < 1) return rangeError(entry.sizeBytes);
                    start = Math.max(0, entry.sizeBytes - suffix);
                } else {
                    start = Long.parseLong(match.group(1));
                    if (!match.group(2).isEmpty()) end = Long.parseLong(match.group(2));
                }
                if (start < 0 || start > end || end >= entry.sizeBytes) return rangeError(entry.sizeBytes);
            }
            Map<String, String> headers = new HashMap<>();
            headers.put("Accept-Ranges", "bytes");
            headers.put("Content-Length", String.valueOf(end - start + 1));
            headers.put("Cache-Control", "private, no-store");
            if (partial) headers.put("Content-Range", "bytes " + start + "-" + end + "/" + entry.sizeBytes);
            // Chromium WebView applies the request Range to an intercepted stream itself.
            // Give it the full file: pre-skipping here makes it skip the same bytes twice.
            return new WebResourceResponse(entry.mime, null, partial ? 206 : 200,
                partial ? "Partial Content" : "OK", headers, new FileInputStream(file));
        } catch (Exception error) {
            android.util.Log.w("BgmPack", "Impossible de servir une musique locale.", error);
            return null;
        }
    }

    private boolean validObject(Entry entry) throws IOException {
        File file = new File(directory, entry.sha256 + ".bin");
        if (!file.isFile() || file.length() != entry.sizeBytes) { verified.remove(entry.sha256); return false; }
        if (verified.contains(entry.sha256)) return true;
        boolean valid = entry.sha256.equals(digest(file));
        if (valid) verified.add(entry.sha256);
        return valid;
    }

    private static WebResourceResponse rangeError(long size) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Range", "bytes */" + size);
        return new WebResourceResponse("text/plain", "UTF-8", 416, "Range Not Satisfiable", headers,
            new java.io.ByteArrayInputStream(new byte[0]));
    }

    private static Map<String, Entry> parseManifest(JSONObject manifest) throws IOException, JSONException {
        if (!"1.0.0".equals(manifest.optString("schemaVersion")) || !"bgm".equals(manifest.optString("packId"))
            || !validHash(manifest.optString("version"))) throw new IOException("Manifeste BGM incompatible.");
        JSONArray files = manifest.getJSONArray("files");
        if (files.length() < 1 || files.length() > 500) throw new IOException("Nombre de BGM invalide.");
        Map<String, Entry> entries = new HashMap<>();
        long total = 0;
        for (int i = 0; i < files.length(); i++) {
            JSONObject file = files.getJSONObject(i);
            String path = file.getString("path");
            String hash = file.getString("sha256");
            long size = file.getLong("sizeBytes");
            String key = file.getString("objectKey");
            if (!path.matches("Audio/BGM/[A-Za-z0-9_ -]+\\.(ogg|mp3)") || !validHash(hash)
                || size < 1 || size > MAX_OBJECT_BYTES
                || !key.equals("resources/audio/sha256/" + hash.substring(0, 2) + "/" + hash + ".bin")
                || entries.put(path, new Entry(hash, size, path.endsWith(".mp3") ? "audio/mpeg" : "audio/ogg")) != null) {
                throw new IOException("Entrée BGM invalide.");
            }
            total += size;
        }
        if (total != manifest.getLong("totalBytes")) throw new IOException("Taille BGM incohérente.");
        return entries;
    }

    private static boolean validHash(String value) { return value != null && value.matches("[a-f0-9]{64}"); }
    private static void atomicRename(File source, File target) throws IOException {
        try { Os.rename(source.getAbsolutePath(), target.getAbsolutePath()); }
        catch (ErrnoException error) { throw new IOException("Activation BGM impossible.", error); }
    }
    private static String digest(File file) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (FileInputStream input = new FileInputStream(file)) {
                byte[] buffer = new byte[64 * 1024];
                int count;
                while ((count = input.read(buffer)) >= 0) digest.update(buffer, 0, count);
            }
            StringBuilder result = new StringBuilder(64);
            for (byte item : digest.digest()) result.append(String.format(java.util.Locale.ROOT, "%02x", item & 0xff));
            return result.toString();
        } catch (NoSuchAlgorithmException error) { throw new IOException(error); }
    }
    private static byte[] readBytes(File file, int maximum) throws IOException {
        if (file.length() > maximum) throw new IOException("Manifeste BGM trop grand.");
        try (FileInputStream input = new FileInputStream(file)) {
            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[16 * 1024];
            int count;
            while ((count = input.read(buffer)) >= 0) output.write(buffer, 0, count);
            return output.toByteArray();
        }
    }
}
