package fr.ocytowine.pokemonzbattle;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertThrows;

import java.io.DataOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.zip.GZIPOutputStream;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class ApkDeltaApplierTest {
    @Rule public TemporaryFolder temp = new TemporaryFolder();

    @Test public void reconstructsExactTargetAndRejectsWrongBase() throws Exception {
        File base = temp.newFile("base.apk");
        File patch = temp.newFile("patch.pzb.gz");
        File output = temp.newFile("output.apk");
        byte[] old = "unchanged-image-old-code".getBytes("UTF-8");
        byte[] next = "unchanged-image-new-code".getBytes("UTF-8");
        Files.write(base.toPath(), old);
        try (DataOutputStream data = new DataOutputStream(new GZIPOutputStream(new FileOutputStream(patch)))) {
            data.write(new byte[] { 'P', 'Z', 'B', 'D', '1' });
            data.write(MessageDigest.getInstance("SHA-256").digest(old));
            data.write(MessageDigest.getInstance("SHA-256").digest(next));
            data.writeLong(old.length);
            data.writeLong(next.length);
            data.writeInt(2);
            data.writeByte(0); data.writeLong(0); data.writeInt(16);
            byte[] tail = "new-code".getBytes("UTF-8");
            data.writeByte(1); data.writeInt(tail.length); data.write(tail);
        }
        ApkDeltaApplier.apply(base, patch, output, ApkDeltaApplier.sha256(base),
            hex(MessageDigest.getInstance("SHA-256").digest(next)), next.length);
        assertArrayEquals(next, Files.readAllBytes(output.toPath()));
        Files.write(base.toPath(), "different-base".getBytes("UTF-8"));
        assertThrows(Exception.class, () -> ApkDeltaApplier.apply(base, patch, output,
            hex(MessageDigest.getInstance("SHA-256").digest(old)),
            hex(MessageDigest.getInstance("SHA-256").digest(next)), next.length));
    }

    @Test public void acceptsOnlyPrivateVersionedPatchLinks() {
        String source = "b".repeat(64);
        String patch = "c".repeat(64);
        PrivateApkDeltaRequest accepted = PrivateApkDeltaRequest.parse(
            "https://pokemon-z-battle-mobile.mimidu33-eb.workers.dev/api/updates/delta/12/13",
            12, source, 392_729_346L, 5_000_000L, patch, 13, 392_738_754L);
        org.junit.Assert.assertEquals(12, accepted.fromVersionCode);
        assertThrows(IllegalArgumentException.class, () -> PrivateApkDeltaRequest.parse(
            "https://example.com/api/updates/delta/12/13", 12, source,
            392_729_346L, 5_000_000L, patch, 13, 392_738_754L));
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte value : bytes) result.append(String.format("%02x", value & 0xff));
        return result.toString();
    }
}
