package fr.ocytowine.pokemonzbattle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(SourceSaveLocatorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
