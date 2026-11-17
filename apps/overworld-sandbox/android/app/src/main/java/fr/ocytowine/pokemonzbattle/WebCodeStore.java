package fr.ocytowine.pokemonzbattle;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** Signed web-code overlay. Game data and media continue to come from the APK and resource packs. */
final class WebCodeStore {
    private static final String HOST = PrivateApkUpdateRequest.HOST;
    private static final String PREFIX = "/__webcode/";
    private static final int MAX_FILE = 8 * 1024 * 1024;
    private final Context context;
    private final File root;
    private final File objects;
    private final File activeFile;
    private final File previousFile;
    private final SharedPreferences state;
    private volatile Bundle active;

    interface Progress { void update(int done, int total); }
    static final class Entry {
        final String path;
        final String hash;
        final int size;
        Entry(String path, String hash, int size) { this.path = path; this.hash = hash; this.size = size; }
    }
    static final class Bundle {
        final String version;
        final String manifest;
        final String script;
        final String style;
        final Map<String, Entry> files;
        Bundle(String version, String manifest, String script, String style, Map<String, Entry> files) {
            this.version = version; this.manifest = manifest; this.script = script; this.style = style;
            this.files = files;
        }
        String url(String path) { return PREFIX + version + "/" + path; }
    }

    WebCodeStore(Context context) {
        this.context = context;
        root = new File(context.getFilesDir(), "web-code");
        objects = new File(root, "objects");
        activeFile = new File(root, "active.json");
        previousFile = new File(root, "previous.json");
        state = context.getSharedPreferences("pokemon-z-battle.web-code", Context.MODE_PRIVATE);
        objects.mkdirs();
    }

    synchronized JSObject boot() {
        try {
            if (state.getBoolean("pending", false) && state.getBoolean("attempted", false)) rollback();
            Bundle candidate = activeFile.isFile() ? parse(readText(activeFile)) : null;
            if (candidate != null && !complete(candidate)) {
                rollback(); candidate = activeFile.isFile() ? parse(readText(activeFile)) : null;
            }
            active = candidate;
            if (candidate != null && state.getBoolean("pending", false)) {
                state.edit().putBoolean("attempted", true).commit();
            }
        } catch (Exception error) { active = null; }
        JSObject result = new JSObject();
        Bundle bundle = active;
        if (bundle != null) {
            try {
                result.put("version", bundle.version);
                result.put("script", bundle.url(bundle.script));
                result.put("style", bundle.url(bundle.style));
            } catch (Exception ignored) { /* Fixed values. */ }
        }
        return result;
    }

    synchronized void healthy(String version) {
        if (active != null && active.version.equals(version)) {
            state.edit().putBoolean("pending", false).putBoolean("attempted", false).commit();
        }
    }

    synchronized void rollback() {
        if (previousFile.isFile()) {
            try { writeAtomic(activeFile, readText(previousFile).getBytes(StandardCharsets.UTF_8)); }
            catch (Exception error) { activeFile.delete(); }
        } else activeFile.delete();
        state.edit().putBoolean("pending", false).putBoolean("attempted", false).commit();
        active = null;
    }

    synchronized String installedVersion() {
        try { return activeFile.isFile() ? parse(readText(activeFile)).version : ""; }
        catch (Exception error) { return ""; }
    }

    synchronized void install(String manifest, String token, Progress progress) throws Exception {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw new Exception("Session mobile absente.");
        Bundle bundle = parse(manifest);
        int done = 0;
        for (Entry entry : bundle.files.values()) {
            File file = new File(objects, entry.hash);
            if (!validObject(file, entry)) {
                download(entry, token, file);
            }
            progress.update(++done, bundle.files.size());
        }
        if (!complete(bundle)) throw new Exception("Code web incomplet.");
        if (activeFile.isFile() && !state.getBoolean("pending", false)) {
            writeAtomic(previousFile, readText(activeFile).getBytes(StandardCharsets.UTF_8));
        }
        writeAtomic(activeFile, manifest.getBytes(StandardCharsets.UTF_8));
        if (!state.edit().putBoolean("pending", true).putBoolean("attempted", false).commit()) {
            throw new Exception("Activation du code impossible.");
        }
    }

    WebResourceResponse responseFor(Uri uri) {
        Bundle bundle = active;
        if (bundle == null || !"localhost".equals(uri.getHost())
            || !"https".equals(uri.getScheme()) || uri.getQuery() != null) return null;
        String path = uri.getPath();
        String prefix = PREFIX + bundle.version + "/";
        if (path == null) return null;
        String relative = path.startsWith(prefix) ? path.substring(prefix.length())
            : path.startsWith("/assets/") ? path.substring(1) : "";
        Entry entry = bundle.files.get(relative);
        if (entry == null) return null;
        String mime = entry.path.endsWith(".js") ? "application/javascript"
            : entry.path.endsWith(".css") ? "text/css"
            : entry.path.endsWith(".png") ? "image/png"
            : entry.path.endsWith(".webp") ? "image/webp"
            : entry.path.endsWith(".svg") ? "image/svg+xml"
            : "font/woff2";
        try {
            File file = new File(objects, entry.hash);
            if (file.length() != entry.size) return null;
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("X-Content-Type-Options", "nosniff");
            return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers,
                new FileInputStream(file));
        } catch (Exception error) { return null; }
    }

    private Bundle parse(String manifest) throws Exception {
        if (manifest.length() > 64 * 1024) throw new Exception("Manifeste de code trop volumineux.");
        JSONObject outer = new JSONObject(manifest);
        String payload = outer.getString("payload");
        String version = outer.getString("version");
        String signature = outer.getString("signature");
        if (!version.matches("[a-f0-9]{64}") || !version.equals(hash(payload.getBytes(StandardCharsets.UTF_8)))) {
            throw new Exception("Empreinte du manifeste de code invalide.");
        }
        byte[] publicKey;
        try (InputStream input = context.getAssets().open("web-code-public.der");
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] bytes = new byte[4096]; int count;
            while ((count = input.read(bytes)) != -1) output.write(bytes, 0, count);
            publicKey = output.toByteArray();
        }
        if (!verifySignature(payload.getBytes(StandardCharsets.UTF_8),
            android.util.Base64.decode(signature, android.util.Base64.DEFAULT), publicKey)) {
            throw new Exception("Signature du code web invalide.");
        }
        JSONObject data = new JSONObject(payload);
        if (!"1.0.0".equals(data.getString("schemaVersion"))
            || data.getInt("nativeVersionCode") != context.getPackageManager()
                .getPackageInfo(context.getPackageName(), 0).getLongVersionCode()
            || !assetHash("local-data-manifest.json").equals(data.getString("dataSha256"))
            || !assetHash("asset-manifest.json").equals(data.getString("assetSha256"))
            || !assetHash("android-resource-layout.json").equals(data.getString("layoutSha256"))) {
            throw new Exception("Code incompatible avec cette APK ou ses ressources.");
        }
        String script = data.getString("entryScript");
        String style = data.getString("entryStyle");
        JSONArray list = data.getJSONArray("files");
        if (list.length() < 2 || list.length() > 200) throw new Exception("Inventaire de code invalide.");
        Map<String, Entry> entries = new HashMap<>();
        long total = 0;
        for (int i = 0; i < list.length(); i++) {
            JSONObject item = list.getJSONObject(i);
            String path = item.getString("path");
            String sha = item.getString("sha256");
            int size = item.getInt("sizeBytes");
            if (!path.matches("assets/[A-Za-z0-9_.-]+\\.(js|css|png|webp|svg|woff|woff2)")
                || !sha.matches("[a-f0-9]{64}") || size <= 0 || size > MAX_FILE
                || entries.containsKey(path)) throw new Exception("Fichier de code invalide.");
            entries.put(path, new Entry(path, sha, size));
            total += size;
        }
        if (total > 32 * 1024 * 1024 || !script.matches("assets/[A-Za-z0-9_.-]+\\.js")
            || !style.matches("assets/[A-Za-z0-9_.-]+\\.css")
            || !entries.containsKey(script) || !entries.containsKey(style)) {
            throw new Exception("Entrées de code manquantes.");
        }
        return new Bundle(version, manifest, script, style, entries);
    }

    private String assetHash(String file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = context.getAssets().open("public/__pokemon-z/data/" + file)) {
            byte[] bytes = new byte[64 * 1024];
            int count;
            while ((count = input.read(bytes)) != -1) digest.update(bytes, 0, count);
        }
        return hex(digest.digest());
    }

    private boolean complete(Bundle bundle) throws Exception {
        for (Entry entry : bundle.files.values()) if (!validObject(new File(objects, entry.hash), entry)) return false;
        return true;
    }

    private boolean validObject(File file, Entry entry) throws Exception {
        return file.isFile() && file.length() == entry.size && entry.hash.equals(hashFile(file));
    }

    private void download(Entry entry, String token, File target) throws Exception {
        URL url = new URL("https://" + HOST + "/api/updates/web/objects/" + entry.hash);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(12_000); connection.setReadTimeout(30_000);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Accept-Encoding", "identity");
        File temporary = File.createTempFile("web-", ".part", objects);
        try {
            if (connection.getResponseCode() != 200) throw new Exception("Téléchargement du code indisponible.");
            long count = 0;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(temporary)) {
                byte[] bytes = new byte[64 * 1024]; int read;
                while ((read = input.read(bytes)) != -1) {
                    count += read;
                    if (count > entry.size) throw new Exception("Objet de code trop volumineux.");
                    output.write(bytes, 0, read); digest.update(bytes, 0, read);
                }
                output.getFD().sync();
            }
            if (count != entry.size || !entry.hash.equals(hex(digest.digest()))) {
                throw new Exception("Objet de code corrompu.");
            }
            if (target.exists() && !target.delete()) throw new Exception("Ancien objet invalide.");
            if (!temporary.renameTo(target)) throw new Exception("Stockage du code impossible.");
        } finally { connection.disconnect(); temporary.delete(); }
    }

    private static void writeAtomic(File target, byte[] bytes) throws Exception {
        File temporary = File.createTempFile("manifest-", ".tmp", target.getParentFile());
        try (FileOutputStream output = new FileOutputStream(temporary)) {
            output.write(bytes); output.getFD().sync();
        }
        try {
            Files.move(temporary.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE,
                StandardCopyOption.REPLACE_EXISTING);
        } catch (java.nio.file.AtomicMoveNotSupportedException error) {
            Files.move(temporary.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static String readText(File file) throws Exception {
        if (file.length() > 64 * 1024) throw new Exception("Manifeste trop volumineux.");
        byte[] bytes = new byte[(int) file.length()];
        try (FileInputStream input = new FileInputStream(file)) {
            int done = 0;
            while (done < bytes.length) {
                int count = input.read(bytes, done, bytes.length - done);
                if (count < 0) throw new Exception("Manifeste incomplet.");
                done += count;
            }
        }
        return new String(bytes, StandardCharsets.UTF_8);
    }

    private static String hashFile(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] bytes = new byte[64 * 1024]; int count;
            while ((count = input.read(bytes)) != -1) digest.update(bytes, 0, count);
        }
        return hex(digest.digest());
    }

    private static String hash(byte[] data) throws Exception {
        return hex(MessageDigest.getInstance("SHA-256").digest(data));
    }
    static boolean verifySignature(byte[] payload, byte[] signature, byte[] publicKey) throws Exception {
        Signature verifier = Signature.getInstance("SHA256withECDSA");
        verifier.initVerify(KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(publicKey)));
        verifier.update(payload);
        return verifier.verify(signature);
    }
    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format("%02x", value & 0xff));
        return result.toString();
    }
}
