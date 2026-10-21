// Eien's own plugin on iOS, as on Android (VaultFilesPlugin.java): the
// vault's writes and renames, done right (VaultFileOps.swift). Paths are in
// the app's Documents, which the Files app shows as "Eien". The window's
// side is src/platform/capacitor/capacitor-files.ts.

import Capacitor
import Foundation

@objc(VaultFilesPlugin)
public class VaultFilesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VaultFilesPlugin"
    public let jsName = "VaultFiles"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "rename", returnType: CAPPluginReturnPromise)
    ]

    /// The text written, and flushed to the disk before the call answers.
    @objc func write(_ call: CAPPluginCall) {
        answer(call) {
            try VaultFileOps.write(call.getString("text") ?? "", to: try Self.inDocuments(call.getString("path")))
        }
    }

    /// In one step; without `replace`, a name that's taken refuses with the code "TAKEN".
    @objc func rename(_ call: CAPPluginCall) {
        answer(call) {
            try VaultFileOps.rename(
                try Self.inDocuments(call.getString("from")),
                to: try Self.inDocuments(call.getString("to")),
                replace: call.getBool("replace") ?? false
            )
        }
    }

    private func answer(_ call: CAPPluginCall, _ operation: () throws -> Void) {
        do {
            try operation()
            call.resolve()
        } catch VaultFileError.taken {
            call.reject("Something is already at that name.", "TAKEN")
        } catch {
            call.reject("\(error)")
        }
    }

    /// A path in the app's Documents: nothing absolute, no "." or ".." (the storage checks too).
    static func inDocuments(_ path: String?) throws -> URL {
        guard let path = path, !path.isEmpty, !path.hasPrefix("/"),
              !path.split(separator: "/", omittingEmptySubsequences: false)
                .contains(where: { $0.isEmpty || $0 == "." || $0 == ".." }),
              let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        else { throw VaultFileError.system("Not a path in Documents: \(path ?? "")") }
        return documents.appendingPathComponent(path)
    }
}

/// The app's window: Capacitor's, with Eien's own plugin registered before the page loads.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(VaultFilesPlugin())
    }
}
