package io.github.onlynyans.eien;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Eien's own, before the bridge starts.
        registerPlugin(AllFilesPlugin.class);
        registerPlugin(VaultFilesPlugin.class);
        super.onCreate(savedInstanceState);
        // The page's viewport as a browser reads it (ui/settings/viewport.ts): without this the
        // WebView lays the page out wider when Interface zoom is under 100%, but never scales it
        // to fit, so the page runs past the screen instead of zooming out.
        getBridge().getWebView().getSettings().setUseWideViewPort(true);
    }
}
