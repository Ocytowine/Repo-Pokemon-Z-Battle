package fr.ocytowine.pokemonzbattle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    private ResourcePackStore resourcePackStore;
    private BgmPackStore bgmPackStore;
    private WebCodeStore webCodeStore;

    ResourcePackStore getResourcePackStore() { return resourcePackStore; }
    BgmPackStore getBgmPackStore() { return bgmPackStore; }
    WebCodeStore getWebCodeStore() { return webCodeStore; }

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(SourceSaveLocatorPlugin.class);
        registerPlugin(ResourcePackPlugin.class);
        registerPlugin(BgmPackPlugin.class);
        registerPlugin(PrivateApkUpdatePlugin.class);
        registerPlugin(MobileAccountPlugin.class);
        registerPlugin(WebCodePackPlugin.class);
        super.onCreate(savedInstanceState);
        resourcePackStore = new ResourcePackStore(this);
        bgmPackStore = new BgmPackStore(this);
        webCodeStore = new WebCodeStore(this);
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse resource = resourcePackStore.imageFor(request.getUrl());
                if (resource == null) resource = bgmPackStore.audioFor(request.getUrl(), request.getRequestHeaders());
                if (resource == null) resource = webCodeStore.responseFor(request.getUrl());
                return resource != null ? resource : super.shouldInterceptRequest(view, request);
            }
        });
    }
}
