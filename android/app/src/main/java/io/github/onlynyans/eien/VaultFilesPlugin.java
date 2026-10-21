package io.github.onlynyans.eien;

import android.os.Environment;
import android.system.ErrnoException;
import android.system.Os;
import android.system.OsConstants;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * The vault's writes and renames on Android (spec §3), where the Filesystem
 * plugin falls short of the storage's contract: its write is never flushed
 * to the disk, and its rename deletes the file it replaces before renaming,
 * so a rename that fails loses both. Paths are in the shared Documents. The
 * window's side is src/platform/capacitor/capacitor-files.ts.
 */
@CapacitorPlugin(name = "VaultFiles")
public class VaultFilesPlugin extends Plugin {

    /** The text written, and flushed to the disk before the call answers. */
    @PluginMethod
    public void write(PluginCall call) {
        try {
            File file = inDocuments(call.getString("path"));
            byte[] bytes = call.getString("text", "").getBytes(StandardCharsets.UTF_8);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(bytes);
                out.getFD().sync();
            }
            call.resolve();
        } catch (IOException | IllegalArgumentException error) {
            call.reject(error.getMessage(), error);
        }
    }

    /**
     * In one step (rename(2)). With replace, a file at `to` is replaced, never deleted first;
     * without, a name that's taken (by any case: the shared storage ignores case) refuses, "TAKEN".
     */
    @PluginMethod
    public void rename(PluginCall call) {
        try {
            File from = inDocuments(call.getString("from"));
            File to = inDocuments(call.getString("to"));
            if (!Boolean.TRUE.equals(call.getBoolean("replace", false)) && to.exists()) {
                call.reject("Something is already at " + call.getString("to") + ".", "TAKEN");
                return;
            }
            Os.rename(from.getPath(), to.getPath());
            syncFolder(to.getParentFile());
            call.resolve();
        } catch (ErrnoException | IllegalArgumentException error) {
            call.reject(error.getMessage(), error);
        }
    }

    /** A path in the shared Documents: nothing absolute, no "." or ".." (the storage checks too). */
    private static File inDocuments(String path) {
        if (path == null || path.isEmpty() || path.startsWith("/")) {
            throw new IllegalArgumentException("Not a path in Documents: " + path);
        }
        for (String part : path.split("/", -1)) {
            if (part.isEmpty() || part.equals(".") || part.equals("..")) {
                throw new IllegalArgumentException("Not a path in Documents: " + path);
            }
        }
        return new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), path);
    }

    /** The rename flushed too, where the system can flush a folder. */
    private static void syncFolder(File folder) {
        if (folder == null) return;
        try {
            FileDescriptor fd = Os.open(folder.getPath(), OsConstants.O_RDONLY, 0);
            try {
                Os.fsync(fd);
            } finally {
                Os.close(fd);
            }
        } catch (ErrnoException cannot) {
            // Some file systems can't flush a folder; the file itself was flushed when written.
        }
    }
}
