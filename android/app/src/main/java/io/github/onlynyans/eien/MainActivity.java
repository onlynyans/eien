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
    }
}
