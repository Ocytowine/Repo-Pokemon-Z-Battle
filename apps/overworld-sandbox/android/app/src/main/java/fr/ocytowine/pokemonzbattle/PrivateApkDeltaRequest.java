package fr.ocytowine.pokemonzbattle;

import java.net.URI;

/** A delta may only be offered through the authenticated mobile update route. */
final class PrivateApkDeltaRequest {
    final String url;
    final int fromVersionCode;
    final String fromSha256;
    final long fromSizeBytes;
    final long sizeBytes;
    final String sha256;

    private PrivateApkDeltaRequest(String url, int fromVersionCode, String fromSha256,
                                  long fromSizeBytes, long sizeBytes, String sha256) {
        this.url = url;
        this.fromVersionCode = fromVersionCode;
        this.fromSha256 = fromSha256;
        this.fromSizeBytes = fromSizeBytes;
        this.sizeBytes = sizeBytes;
        this.sha256 = sha256;
    }

    static PrivateApkDeltaRequest parse(String url, Integer fromVersionCode, String fromSha256,
                                        Long fromSizeBytes, Long sizeBytes, String sha256,
                                        int targetVersionCode, long targetSizeBytes) {
        if (url == null || fromVersionCode == null || fromVersionCode <= 0
            || fromVersionCode >= targetVersionCode || fromSha256 == null
            || !fromSha256.matches("[a-f0-9]{64}") || fromSizeBytes == null
            || fromSizeBytes <= 0 || fromSizeBytes > 2_000_000_000L
            || sizeBytes == null || sizeBytes <= 0 || sizeBytes >= targetSizeBytes * 0.9
            || sha256 == null || !sha256.matches("[a-f0-9]{64}")) {
            throw new IllegalArgumentException("Manifeste du patch APK invalide.");
        }
        try {
            URI uri = URI.create(url);
            if (!"https".equals(uri.getScheme()) || !PrivateApkUpdateRequest.HOST.equals(uri.getHost())
                || uri.getPort() != -1 || uri.getRawQuery() != null || uri.getRawFragment() != null
                || uri.getRawUserInfo() != null || !uri.getPath().equals("/api/updates/delta/"
                    + fromVersionCode + "/" + targetVersionCode)) {
                throw new IllegalArgumentException("Lien du patch APK non autorisé.");
            }
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("Lien du patch APK non autorisé.");
        }
        return new PrivateApkDeltaRequest(url, fromVersionCode, fromSha256, fromSizeBytes,
            sizeBytes, sha256);
    }
}
