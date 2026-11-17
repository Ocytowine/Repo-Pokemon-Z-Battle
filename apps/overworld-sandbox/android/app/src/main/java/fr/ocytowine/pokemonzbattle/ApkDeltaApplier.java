package fr.ocytowine.pokemonzbattle;

import java.io.DataInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.zip.GZIPInputStream;

/** Reconstructs the exact signed APK bytes from verified local and remote inputs. */
final class ApkDeltaApplier {
    private static final byte[] MAGIC = new byte[] { 'P', 'Z', 'B', 'D', '1' };
    private static final long MAX_APK = 2_000_000_000L;

    static void apply(File base, File patch, File output, String baseSha256, String targetSha256,
                      long expectedTargetSize) throws Exception {
        if (!base.isFile() || !patch.isFile() || expectedTargetSize <= 0 || expectedTargetSize > MAX_APK
            || !sha256(base).equals(baseSha256)) throw new IOException("APK installée différente de la base du patch.");
        try (DataInputStream input = new DataInputStream(new GZIPInputStream(new FileInputStream(patch)));
             RandomAccessFile previous = new RandomAccessFile(base, "r");
             FileOutputStream result = new FileOutputStream(output)) {
            byte[] magic = new byte[5]; input.readFully(magic);
            if (!Arrays.equals(MAGIC, magic)) throw new IOException("Format de patch inconnu.");
            byte[] oldHash = new byte[32]; input.readFully(oldHash);
            byte[] newHash = new byte[32]; input.readFully(newHash);
            long oldSize = input.readLong();
            long newSize = input.readLong();
            long operations = Integer.toUnsignedLong(input.readInt());
            if (!hex(oldHash).equals(baseSha256) || !hex(newHash).equals(targetSha256)
                || oldSize != base.length() || newSize != expectedTargetSize
                || operations == 0 || operations > 1_000_000) throw new IOException("En-tête de patch invalide.");
            byte[] buffer = new byte[64 * 1024];
            long written = 0;
            for (long operation = 0; operation < operations; operation++) {
                int type = input.readUnsignedByte();
                long offset = type == 0 ? input.readLong() : 0;
                long length = Integer.toUnsignedLong(input.readInt());
                if (length == 0 || written + length > newSize
                    || type != 0 && type != 1 || type == 0 && (offset < 0 || offset > oldSize - length)) {
                    throw new IOException("Opération de patch invalide.");
                }
                if (type == 0) previous.seek(offset);
                long remaining = length;
                while (remaining > 0) {
                    int count = (int) Math.min(buffer.length, remaining);
                    if (type == 0) previous.readFully(buffer, 0, count);
                    else input.readFully(buffer, 0, count);
                    result.write(buffer, 0, count);
                    remaining -= count;
                }
                written += length;
            }
            if (written != newSize || input.read() != -1) throw new IOException("Patch tronqué ou excédentaire.");
            result.getFD().sync();
        } catch (Exception error) {
            output.delete();
            throw error;
        }
        if (!sha256(output).equals(targetSha256)) {
            output.delete();
            throw new IOException("Empreinte de l'APK reconstruite invalide.");
        }
    }

    static String sha256(File file) throws Exception {
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        byte[] buffer = new byte[64 * 1024];
        try (FileInputStream input = new FileInputStream(file)) {
            int count;
            while ((count = input.read(buffer)) != -1) hash.update(buffer, 0, count);
        }
        return hex(hash.digest());
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format("%02x", value & 0xff));
        return result.toString();
    }
}
