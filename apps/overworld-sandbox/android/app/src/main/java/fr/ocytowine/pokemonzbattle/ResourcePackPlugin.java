package fr.ocytowine.pokemonzbattle;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ResourcePack")
public class ResourcePackPlugin extends Plugin {
    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("version", ((MainActivity) getActivity()).getResourcePackStore().activeVersion());
        call.resolve(result);
    }

    @PluginMethod
    public void missingObjects(PluginCall call) {
        String manifest = call.getString("manifest");
        if (manifest == null || manifest.length() > 1024 * 1024) { call.reject("Manifeste invalide."); return; }
        getBridge().execute(() -> {
            try {
                JSArray missing = new JSArray();
                for (String hash : ((MainActivity) getActivity()).getResourcePackStore().missingObjects(manifest)) {
                    missing.put(hash);
                }
                JSObject result = new JSObject();
                result.put("missing", missing);
                call.resolve(result);
            } catch (Exception error) { call.reject("Manifeste invalide.", error); }
        });
    }

    @PluginMethod
    public void installObject(PluginCall call) {
        String hash = call.getString("sha256");
        Integer size = call.getInt("sizeBytes");
        String base64 = call.getString("base64");
        if (hash == null || size == null || base64 == null || base64.length() > 12 * 1024 * 1024) {
            call.reject("Objet invalide."); return;
        }
        getBridge().execute(() -> {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                ((MainActivity) getActivity()).getResourcePackStore().installObject(hash, size, bytes);
                call.resolve();
            } catch (Exception error) { call.reject("Échec de vérification de l'objet.", error); }
        });
    }

    @PluginMethod
    public void activate(PluginCall call) {
        String manifest = call.getString("manifest");
        if (manifest == null || manifest.length() > 1024 * 1024) { call.reject("Manifeste invalide."); return; }
        getBridge().execute(() -> {
            try {
                int count = ((MainActivity) getActivity()).getResourcePackStore().activate(manifest);
                JSObject result = new JSObject();
                result.put("count", count);
                call.resolve(result);
            } catch (Exception error) { call.reject("Pack incomplet ou invalide.", error); }
        });
    }
}
