package fr.ocytowine.pokemonzbattle;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import org.junit.Test;

public class WebCodeStoreTest {
    @Test public void acceptsOnlyBytesSignedByThePinnedKey() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair pair = generator.generateKeyPair();
        byte[] payload = "version=known-good".getBytes(StandardCharsets.UTF_8);
        Signature signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign(pair.getPrivate()); signer.update(payload);
        byte[] signature = signer.sign();
        assertTrue(WebCodeStore.verifySignature(payload, signature, pair.getPublic().getEncoded()));
        assertFalse(WebCodeStore.verifySignature("version=changed".getBytes(StandardCharsets.UTF_8),
            signature, pair.getPublic().getEncoded()));
    }
}
