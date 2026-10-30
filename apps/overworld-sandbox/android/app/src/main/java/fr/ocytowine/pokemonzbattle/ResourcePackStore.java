package fr.ocytowine.pokemonzbattle;

import android.content.Context;
import android.net.Uri;
import android.system.Os;
import android.system.ErrnoException;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Verified, private resource overlay. Absent or corrupt files fall back to APK assets. */
final class ResourcePackStore {
    private static final String RESOURCE_PREFIX = "/__pokemon-z/source/";
    private static final int MAX_OBJECT_BYTES = 8 * 1024 * 1024;
    private final File directory;
    private volatile Map<String, Entry> active = Collections.emptyMap();
    private volatile String activeVersion = "";

    private static final class Entry {
        final String sha256;
        final long sizeBytes;
        Entry(String sha256, long sizeBytes) { this.sha256 = sha256; this.sizeBytes = sizeBytes; }
    }

    ResourcePackStore(Context context) {
        directory = new File(context.getFilesDir(), "resource-packs");
        if (!directory.isDirectory() && !directory.mkdirs()) return;
        try {
            File manifest = new File(directory, "active.json");
            if (manifest.isFile()) {
                JSONObject json = new JSONObject(new String(readBytes(manifest, 1024 * 1024),
                    java.nio.charset.StandardCharsets.UTF_8));
                active = parseManifest(json);
                activeVersion = json.optString("version", "");
            }
        } catch (Exception ignored) { active = Collections.emptyMap(); }
    }

    synchronized void installObject(String sha256, long sizeBytes, byte[] bytes) throws IOException {
        if (!validHash(sha256) || sizeBytes < 1 || sizeBytes > MAX_OBJECT_BYTES
            || bytes.length != sizeBytes || !sha256.equals(digest(bytes))) throw new IOException("Objet non conforme.");
        File target = new File(directory, sha256 + ".png");
        if (target.isFile() && target.length() == sizeBytes && sha256.equals(digest(readBytes(target, MAX_OBJECT_BYTES)))) return;
        File temporary = File.createTempFile("resource-", ".tmp", directory);
        try {
            try (FileOutputStream stream = new FileOutputStream(temporary)) {
                stream.write(bytes);
                stream.getFD().sync();
            }
            atomicRename(temporary, target);
        } finally { temporary.delete(); }
    }

    synchronized int activate(String json) throws IOException, JSONException {
        JSONObject manifest = new JSONObject(json);
        Map<String, Entry> entries = parseManifest(manifest);
        if (entries.isEmpty()) throw new IOException("Pack vide.");
        for (Entry entry : entries.values()) {
            File object = new File(directory, entry.sha256 + ".png");
            if (!object.isFile() || object.length() != entry.sizeBytes
                || !entry.sha256.equals(digest(readBytes(object, MAX_OBJECT_BYTES)))) {
                throw new IOException("Pack incomplet ou objet corrompu.");
            }
        }
        File temporary = File.createTempFile("active-", ".tmp", directory);
        try {
            try (FileOutputStream stream = new FileOutputStream(temporary)) {
                stream.write(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                stream.getFD().sync();
            }
            File target = new File(directory, "active.json");
            atomicRename(temporary, target);
            active = Collections.unmodifiableMap(entries);
            activeVersion = manifest.optString("version", "");
        } finally { temporary.delete(); }
        return entries.size();
    }

    String activeVersion() { return activeVersion; }

    synchronized List<String> missingObjects(String json) throws IOException, JSONException {
        Map<String, Entry> entries = parseManifest(new JSONObject(json));
        Set<String> checked = new HashSet<>();
        List<String> missing = new ArrayList<>();
        for (Entry entry : entries.values()) {
            if (!checked.add(entry.sha256)) continue;
            File object = new File(directory, entry.sha256 + ".png");
            try {
                if (!object.isFile() || object.length() != entry.sizeBytes
                    || !entry.sha256.equals(digest(readBytes(object, MAX_OBJECT_BYTES)))) missing.add(entry.sha256);
            } catch (IOException ignored) { missing.add(entry.sha256); }
        }
        return missing;
    }

    WebResourceResponse imageFor(Uri uri) {
        if (!"https".equals(uri.getScheme()) || !"localhost".equals(uri.getHost())) return null;
        String requestPath = uri.getPath();
        if (requestPath == null || !requestPath.startsWith(RESOURCE_PREFIX)) return null;
        String path = requestPath.substring(RESOURCE_PREFIX.length());
        Entry entry = active.get(path);
        if (entry == null) return null;
        try {
            File object = new File(directory, entry.sha256 + ".png");
            if (object.length() != entry.sizeBytes) return null;
            byte[] bytes = readBytes(object, MAX_OBJECT_BYTES);
            if (!entry.sha256.equals(digest(bytes))) return null;
            return new WebResourceResponse("image/png", null, new ByteArrayInputStream(bytes));
        } catch (IOException ignored) { return null; }
    }

    private static Map<String, Entry> parseManifest(JSONObject manifest) throws JSONException, IOException {
        if (!"1.0.0".equals(manifest.optString("schemaVersion"))
            || !"battlebacks-wide".equals(manifest.optString("packId"))) throw new IOException("Manifeste incompatible.");
        JSONArray files = manifest.getJSONArray("files");
        if (files.length() < 1 || files.length() > 200) throw new IOException("Nombre de fichiers invalide.");
        Map<String, Entry> entries = new HashMap<>();
        for (int index = 0; index < files.length(); index++) {
            JSONObject file = files.getJSONObject(index);
            String path = file.getString("path");
            String sha256 = file.getString("sha256");
            long sizeBytes = file.getLong("sizeBytes");
            if (!path.matches("Graphics/Battlebacks/battlebg[A-Za-z0-9_-]+Z\\.png")
                || !validHash(sha256) || sizeBytes < 1 || sizeBytes > MAX_OBJECT_BYTES
                || entries.put(path, new Entry(sha256, sizeBytes)) != null) throw new IOException("Entrée de pack invalide.");
        }
        return entries;
    }

    private static boolean validHash(String value) { return value != null && value.matches("[a-f0-9]{64}"); }

    private static void atomicRename(File source, File target) throws IOException {
        try { Os.rename(source.getAbsolutePath(), target.getAbsolutePath()); }
        catch (ErrnoException error) { throw new IOException("Remplacement atomique impossible.", error); }
    }

    private static String digest(byte[] bytes) throws IOException {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder result = new StringBuilder(64);
            for (byte item : hash) result.append(String.format(java.util.Locale.ROOT, "%02x", item & 0xff));
            return result.toString();
        } catch (NoSuchAlgorithmException error) { throw new IOException(error); }
    }

    private static byte[] readBytes(File file, int maximum) throws IOException {
        if (file.length() > maximum) throw new IOException("Objet trop grand.");
        try (FileInputStream stream = new FileInputStream(file)) {
            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[16 * 1024];
            int count;
            while ((count = stream.read(buffer)) >= 0) {
                output.write(buffer, 0, count);
                if (output.size() > maximum) throw new IOException("Objet trop grand.");
            }
            return output.toByteArray();
        }
    }
}
