package fr.ocytowine.pokemonzbattle;

import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BgmPack")
public class BgmPackPlugin extends Plugin {
    private BgmPackStore store() { return ((MainActivity) getActivity()).getBgmPackStore(); }

    @PluginMethod public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("version", store().activeVersion());
        call.resolve(result);
    }

    @PluginMethod public void missingObjects(PluginCall call) {
        String manifest = call.getString("manifest");
        if (manifest == null || manifest.length() > 1024 * 1024) { call.reject("Manifeste BGM invalide."); return; }
        getBridge().execute(() -> {
            try {
                JSArray missing = new JSArray();
                for (String hash : store().missingObjects(manifest)) missing.put(hash);
                JSObject result = new JSObject();
                result.put("missing", missing);
                call.resolve(result);
            } catch (Exception error) { call.reject("Inventaire BGM invalide.", error); }
        });
    }

    @PluginMethod public void installChunk(PluginCall call) {
        String hash = call.getString("sha256");
        Integer size = call.getInt("sizeBytes");
        Integer offset = call.getInt("offset");
        String base64 = call.getString("base64");
        if (hash == null || size == null || offset == null || base64 == null || base64.length() > 6 * 1024 * 1024) {
            call.reject("Morceau BGM invalide."); return;
        }
        getBridge().execute(() -> {
            try {
                store().installChunk(hash, size, offset, Base64.decode(base64, Base64.DEFAULT));
                call.resolve();
            } catch (Exception error) { call.reject("Échec de vérification du BGM.", error); }
        });
    }

    @PluginMethod public void activate(PluginCall call) {
        String manifest = call.getString("manifest");
        if (manifest == null || manifest.length() > 1024 * 1024) { call.reject("Manifeste BGM invalide."); return; }
        getBridge().execute(() -> {
            try {
                JSObject result = new JSObject();
                result.put("count", store().activate(manifest));
                call.resolve(result);
            } catch (Exception error) { call.reject("Pack BGM incomplet ou invalide.", error); }
        });
    }
}
