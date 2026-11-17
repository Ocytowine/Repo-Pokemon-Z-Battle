package fr.ocytowine.pokemonzbattle;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WebCodePack")
public class WebCodePackPlugin extends Plugin {
    private WebCodeStore store() { return ((MainActivity) getActivity()).getWebCodeStore(); }

    @PluginMethod public void boot(PluginCall call) { call.resolve(store().boot()); }

    @PluginMethod public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("version", store().installedVersion());
        call.resolve(result);
    }

    @PluginMethod public void healthy(PluginCall call) {
        store().healthy(call.getString("version", ""));
        call.resolve();
    }

    @PluginMethod public void rollback(PluginCall call) {
        store().rollback();
        call.resolve();
    }

    @PluginMethod public void install(PluginCall call) {
        String manifest = call.getString("manifest");
        String token = call.getString("token");
        if (manifest == null || manifest.length() > 64 * 1024) {
            call.reject("Manifeste de code invalide."); return;
        }
        getBridge().execute(() -> {
            try {
                store().install(manifest, token, (done, total) -> {
                    JSObject progress = new JSObject();
                    progress.put("done", done); progress.put("total", total);
                    notifyListeners("progress", progress);
                });
                call.resolve();
            } catch (Exception error) {
                call.reject(error.getMessage() == null ? "Mise à jour du code impossible." : error.getMessage());
            }
        });
    }
}
