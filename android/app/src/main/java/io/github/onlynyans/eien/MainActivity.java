package io.github.onlynyans.eien;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AllFilesPlugin.class); // Eien's own, before the bridge starts
        super.onCreate(savedInstanceState);
    }
}
