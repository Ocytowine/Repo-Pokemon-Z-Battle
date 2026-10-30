package fr.ocytowine.pokemonzbattle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    private ResourcePackStore resourcePackStore;
    private BgmPackStore bgmPackStore;

    ResourcePackStore getResourcePackStore() { return resourcePackStore; }
    BgmPackStore getBgmPackStore() { return bgmPackStore; }

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(SourceSaveLocatorPlugin.class);
        registerPlugin(ResourcePackPlugin.class);
        registerPlugin(BgmPackPlugin.class);
        super.onCreate(savedInstanceState);
        resourcePackStore = new ResourcePackStore(this);
        bgmPackStore = new BgmPackStore(this);
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse resource = resourcePackStore.imageFor(request.getUrl());
                if (resource == null) resource = bgmPackStore.audioFor(request.getUrl(), request.getRequestHeaders());
                return resource != null ? resource : super.shouldInterceptRequest(view, request);
            }
        });
    }
}
