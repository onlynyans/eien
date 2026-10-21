package io.github.onlynyans.eien;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android's "All files access" (spec §10). The vault is a folder in the
 * shared Documents, which Syncthing syncs; from Android 11, an app may use
 * the files other apps made there only with this access. Before 11 the
 * storage permission does it (asked for by the Filesystem plugin).
 * The window's side is src/app/mobile/all-files.ts.
 */
@CapacitorPlugin(name = "AllFiles")
public class AllFilesPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        answer(call);
    }

    /** The system's own screen for the access; answers when the writer comes back from it. */
    @PluginMethod
    public void request(PluginCall call) {
        if (granted()) {
            answer(call);
            return;
        }
        Uri app = Uri.parse("package:" + getContext().getPackageName());
        try {
            startActivityForResult(call, new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, app), "returned");
        } catch (ActivityNotFoundException noScreenForOneApp) {
            // Some phones only have the list of every app's access.
            startActivityForResult(call, new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION), "returned");
        }
    }

    @ActivityCallback
    private void returned(PluginCall call, ActivityResult result) {
        answer(call);
    }

    private void answer(PluginCall call) {
        JSObject out = new JSObject();
        out.put("granted", granted());
        call.resolve(out);
    }

    private static boolean granted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.R || Environment.isExternalStorageManager();
    }
}
