package fr.ocytowine.pokemonzbattle;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** The revocable mobile session is encrypted at rest with a device-only key. */
@CapacitorPlugin(name = "MobileAccount")
public class MobileAccountPlugin extends Plugin {
    private static final String KEY_ALIAS = "pokemon-z-battle.mobile-account.v1";
    private static final String PREFERENCES = "pokemon-z-battle.mobile-account";
    private static final String TOKEN_KEY = "encrypted-token";
    private static final String SIGNED_OUT_KEY = "signed-out";

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) return (SecretKey) store.getKey(KEY_ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        return generator.generateKey();
    }

    @PluginMethod public void store(PluginCall call) {
        String token = call.getString("token");
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) {
            call.reject("Session mobile invalide."); return;
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
            byte[] iv = cipher.getIV();
            byte[] stored = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, stored, 0, iv.length);
            System.arraycopy(encrypted, 0, stored, iv.length, encrypted.length);
            if (!preferences().edit().putString(TOKEN_KEY, Base64.encodeToString(stored, Base64.NO_WRAP))
                .putBoolean(SIGNED_OUT_KEY, false).commit()) {
                throw new Exception("Écriture locale impossible.");
            }
            call.resolve();
        } catch (Exception error) { call.reject("Impossible d'enregistrer la session sur ce téléphone.", error); }
    }

    @PluginMethod public void token(PluginCall call) {
        String encoded = preferences().getString(TOKEN_KEY, null);
        String token = null;
        if (encoded != null) {
            try {
                byte[] stored = Base64.decode(encoded, Base64.DEFAULT);
                if (stored.length < 29) throw new Exception("Session locale invalide.");
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Arrays.copyOfRange(stored, 0, 12)));
                token = new String(cipher.doFinal(Arrays.copyOfRange(stored, 12, stored.length)), StandardCharsets.UTF_8);
                if (!token.matches("[A-Za-z0-9_-]{43}")) throw new Exception("Session locale invalide.");
            } catch (Exception error) {
                preferences().edit().remove(TOKEN_KEY).apply();
                token = null;
            }
        }
        JSObject result = new JSObject();
        result.put("token", token == null ? JSONObject.NULL : token);
        result.put("signedOut", preferences().getBoolean(SIGNED_OUT_KEY, false));
        call.resolve(result);
    }

    @PluginMethod public void clear(PluginCall call) {
        if (preferences().edit().remove(TOKEN_KEY).putBoolean(SIGNED_OUT_KEY, true).commit()) call.resolve();
        else call.reject("Impossible d'effacer la session locale.");
    }
}
