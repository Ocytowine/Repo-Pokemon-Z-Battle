package fr.ocytowine.pokemonzbattle;

import java.net.URI;
import java.util.Locale;

/** Only the authenticated update route of our Worker may supply an APK. */
final class PrivateApkUpdateRequest {
    static final String HOST = "pokemon-z-battle-mobile.mimidu33-eb.workers.dev";
    final String url;
    final int versionCode;
    final long sizeBytes;
    final String sha256;

    /** Capacitor JSON uses Integer below 2^31 and Long above it. Accept both without rounding. */
    static Long wholeNumber(Object value) {
        if (!(value instanceof Number)) return null;
        Number number = (Number) value;
        long whole = number.longValue();
        double decimal = number.doubleValue();
        return Double.isFinite(decimal) && decimal == whole ? whole : null;
    }

    private PrivateApkUpdateRequest(String url, int versionCode, long sizeBytes, String sha256) {
        this.url = url;
        this.versionCode = versionCode;
        this.sizeBytes = sizeBytes;
        this.sha256 = sha256;
    }

    static PrivateApkUpdateRequest parse(String url, Integer versionCode, Long sizeBytes, String sha256) {
        if (url == null || versionCode == null || versionCode <= 0 || sizeBytes == null
            || sizeBytes <= 0 || sizeBytes > 2_000_000_000L || sha256 == null
            || !sha256.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("Manifeste APK invalide.");
        try {
            URI uri = URI.create(url);
            if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost()) || uri.getPort() != -1
                || uri.getRawQuery() != null || uri.getRawFragment() != null || uri.getRawUserInfo() != null
                || !uri.getPath().equals("/api/updates/download/" + versionCode)) {
                throw new IllegalArgumentException("Lien APK non autorisé.");
            }
        } catch (IllegalArgumentException error) { throw new IllegalArgumentException("Lien APK non autorisé."); }
        return new PrivateApkUpdateRequest(url, versionCode, sizeBytes, sha256.toLowerCase(Locale.ROOT));
    }

    static boolean matchesRange(String value, long offset, long sizeBytes) {
        return ("bytes " + offset + "-" + (sizeBytes - 1) + "/" + sizeBytes).equals(value);
    }
}
