package fr.ocytowine.pokemonzbattle;

import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicBoolean;

/** Streams a private APK using the revocable mobile account session. */
@CapacitorPlugin(name = "PrivateApkUpdate")
public class PrivateApkUpdatePlugin extends Plugin {
    private static final String APK_MIME = "application/vnd.android.package-archive";
    private final AtomicBoolean active = new AtomicBoolean(false);

    @PluginMethod public void downloadAndInstall(PluginCall call) {
        final PrivateApkUpdateRequest request;
        final PrivateApkDeltaRequest delta;
        final String token = call.getString("token");
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) {
            call.reject("Session mobile absente."); return;
        }
        try {
            request = PrivateApkUpdateRequest.parse(call.getString("url"), call.getInt("versionCode"),
                call.getLong("sizeBytes"), call.getString("sha256"));
            JSObject deltaInput = call.getObject("delta");
            delta = deltaInput == null ? null : PrivateApkDeltaRequest.parse(
                deltaInput.optString("url", null), deltaInput.optInt("fromVersionCode", 0),
                deltaInput.optString("fromSha256", null), deltaInput.optLong("fromSizeBytes", 0),
                deltaInput.optLong("sizeBytes", 0), deltaInput.optString("sha256", null),
                request.versionCode, request.sizeBytes);
        } catch (IllegalArgumentException error) { call.reject(error.getMessage()); return; }
        if (!active.compareAndSet(false, true)) { call.reject("Un téléchargement est déjà en cours."); return; }
        getBridge().execute(() -> {
            try {
                File apk = delta == null ? download(request, token) : downloadWithDelta(request, delta, token);
                getActivity().runOnUiThread(() -> openInstaller(call, apk));
            } catch (LoginRequired error) {
                JSObject result = new JSObject();
                result.put("state", "login-required");
                call.resolve(result);
            } catch (Exception error) {
                call.reject(error.getMessage() == null ? "Téléchargement APK interrompu." : error.getMessage());
            } finally { active.set(false); }
        });
    }

    private File downloadWithDelta(PrivateApkUpdateRequest request, PrivateApkDeltaRequest delta,
                                   String token) throws Exception {
        PackageInfo installed = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
        File base = new File(getContext().getApplicationInfo().sourceDir);
        if (installed.getLongVersionCode() != delta.fromVersionCode || !base.isFile()
            || base.length() != delta.fromSizeBytes
            || !ApkDeltaApplier.sha256(base).equals(delta.fromSha256)) return download(request, token);
        File folder = new File(getContext().getCacheDir(), "updates");
        if (!folder.isDirectory() && !folder.mkdirs()) throw new Exception("Espace de téléchargement indisponible.");
        File patch = new File(folder, "delta-" + delta.fromVersionCode + "-" + request.versionCode
            + "-" + delta.sha256.substring(0, 12) + ".pzb.gz");
        File partial = new File(folder, patch.getName() + ".part");
        if (!verifiedBytes(patch, delta.sizeBytes, delta.sha256)) {
            if (patch.exists() && !patch.delete()) throw new Exception("Ancien patch invalide.");
            if (partial.length() > delta.sizeBytes && !partial.delete()) throw new Exception("Patch partiel invalide.");
            if (partial.length() < delta.sizeBytes) stream(delta.url, delta.sizeBytes,
                "application/octet-stream", partial, token);
            if (!verifiedBytes(partial, delta.sizeBytes, delta.sha256)) {
                partial.delete(); throw new Exception("Patch téléchargé invalide.");
            }
            if (!partial.renameTo(patch)) throw new Exception("Impossible de préparer le patch APK.");
        }
        String stem = "pokemon-z-battle-" + request.versionCode + "-" + request.sha256.substring(0, 12);
        File apk = new File(folder, stem + ".apk");
        if (verified(apk, request)) return apk;
        File reconstructed = new File(folder, stem + ".reconstructing");
        try {
            ApkDeltaApplier.apply(base, patch, reconstructed, delta.fromSha256, request.sha256, request.sizeBytes);
            if (apk.exists() && !apk.delete()) throw new Exception("Ancien APK invalide.");
            if (!reconstructed.renameTo(apk) || !verifiedPackage(apk, request)) {
                apk.delete(); throw new Exception("APK reconstruite non installable.");
            }
            return apk;
        } finally { reconstructed.delete(); }
    }

    private File download(PrivateApkUpdateRequest request, String token) throws Exception {
        File folder = new File(getContext().getCacheDir(), "updates");
        if (!folder.isDirectory() && !folder.mkdirs()) throw new Exception("Espace de téléchargement indisponible.");
        String stem = "pokemon-z-battle-" + request.versionCode + "-" + request.sha256.substring(0, 12);
        File apk = new File(folder, stem + ".apk");
        File partial = new File(folder, stem + ".part");
        if (apk.isFile() && verified(apk, request)) return apk;
        if (apk.exists() && !apk.delete()) throw new Exception("Ancien APK invalide impossible à remplacer.");
        if (partial.length() > request.sizeBytes && !partial.delete()) {
            throw new Exception("Téléchargement partiel invalide.");
        }
        if (partial.length() < request.sizeBytes) stream(request.url, request.sizeBytes, APK_MIME, partial, token);
        if (!verifiedBytes(partial, request)) {
            partial.delete();
            throw new Exception("APK téléchargée incomplète ou invalide. Réessaie le téléchargement.");
        }
        if (!partial.renameTo(apk)) throw new Exception("Impossible de préparer l'APK téléchargée.");
        if (!verifiedPackage(apk, request)) {
            apk.delete();
            throw new Exception("Cette APK ne correspond pas à l'application ou à la version attendue.");
        }
        return apk;
    }

    private void stream(String url, long sizeBytes, String mime, File partial, String token) throws Exception {
        long offset = partial.length();
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(12_000);
        connection.setReadTimeout(25_000);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Accept", mime);
        connection.setRequestProperty("Accept-Encoding", "identity");
        connection.setRequestProperty("X-Requested-With", "XMLHttpRequest");
        if (offset > 0) connection.setRequestProperty("Range", "bytes=" + offset + "-");
        try {
            int status = connection.getResponseCode();
            if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308
                || status == 401 || status == 403) throw new LoginRequired();
            if (status != 200 && status != 206) throw new Exception("Téléchargement APK indisponible (" + status + ").");
            String contentType = connection.getContentType();
            if (contentType == null || !contentType.toLowerCase().startsWith(mime)) {
                throw new Exception("Réponse APK inattendue.");
            }
            if (status == 206 && (offset == 0 || !PrivateApkUpdateRequest.matchesRange(
                connection.getHeaderField("Content-Range"), offset, sizeBytes))) {
                throw new Exception("Reprise de téléchargement invalide.");
            }
            if (status == 200) offset = 0;
            long expectedLength = sizeBytes - offset;
            long contentLength = connection.getContentLengthLong();
            if (contentLength >= 0 && contentLength != expectedLength) {
                throw new Exception("Taille APK distante inattendue.");
            }
            long done = offset;
            long reported = done;
            byte[] bytes = new byte[64 * 1024];
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial, offset > 0)) {
                int count;
                while ((count = input.read(bytes)) != -1) {
                    done += count;
                    if (done > sizeBytes) throw new Exception("Téléchargement trop volumineux.");
                    output.write(bytes, 0, count);
                    if (done - reported >= 4 * 1024 * 1024 || done == sizeBytes) {
                        JSObject progress = new JSObject();
                        progress.put("done", done);
                        progress.put("total", sizeBytes);
                        progress.put("kind", APK_MIME.equals(mime) ? "apk" : "delta");
                        notifyListeners("progress", progress);
                        reported = done;
                    }
                }
            }
            if (done != sizeBytes) throw new Exception("Téléchargement interrompu. Réessaie pour reprendre.");
        } finally { connection.disconnect(); }
    }

    private boolean verified(File file, PrivateApkUpdateRequest request) throws Exception {
        return verifiedBytes(file, request.sizeBytes, request.sha256) && verifiedPackage(file, request);
    }

    private boolean verifiedBytes(File file, PrivateApkUpdateRequest request) throws Exception {
        return verifiedBytes(file, request.sizeBytes, request.sha256);
    }

    private boolean verifiedBytes(File file, long sizeBytes, String sha256) throws Exception {
        if (!file.isFile() || file.length() != sizeBytes) return false;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = new byte[64 * 1024];
        try (FileInputStream input = new FileInputStream(file)) {
            int count;
            while ((count = input.read(bytes)) != -1) digest.update(bytes, 0, count);
        }
        byte[] actual = digest.digest();
        StringBuilder hex = new StringBuilder(actual.length * 2);
        for (byte value : actual) hex.append(String.format("%02x", value & 0xff));
        return sha256.equals(hex.toString());
    }

    private boolean verifiedPackage(File file, PrivateApkUpdateRequest request) {
        PackageInfo info = getContext().getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(), 0);
        return info != null && getContext().getPackageName().equals(info.packageName)
            && info.getLongVersionCode() == request.versionCode;
    }

    private void openInstaller(PluginCall call, File apk) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
                Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(settings);
                JSObject result = new JSObject();
                result.put("state", "permission-required");
                call.resolve(result);
                return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(),
                getContext().getPackageName() + ".fileprovider", apk);
            Intent install = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            install.setDataAndType(uri, APK_MIME);
            install.setClipData(ClipData.newUri(getContext().getContentResolver(), "APK vérifiée", uri));
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(install);
            JSObject result = new JSObject();
            result.put("state", "installer-opened");
            call.resolve(result);
        } catch (Exception error) { call.reject("Impossible d'ouvrir l'installation Android.", error); }
    }

    private static final class LoginRequired extends Exception { }
}
