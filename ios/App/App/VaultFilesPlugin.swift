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
        CAPPluginMethod(name: "rename", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "list", returnType: CAPPluginReturnPromise)
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

    /// A folder's files and folders, each as itself; "MISSING" when there's no folder.
    @objc func list(_ call: CAPPluginCall) {
        answer(call) {
            let entries = try VaultFileOps.list(try Self.inDocuments(call.getString("path")))
            return [
                "files": entries.map { entry -> [String: Any] in
                    [
                        "name": entry.name,
                        "type": entry.directory ? "directory" : "file",
                        "size": entry.size,
                        "mtime": entry.mtime
                    ]
                }
            ]
        }
    }

    private func answer(_ call: CAPPluginCall, _ operation: () throws -> Void) {
        answer(call) {
            try operation()
            return [:]
        }
    }

    private func answer(_ call: CAPPluginCall, _ operation: () throws -> [String: Any]) {
        do {
            call.resolve(try operation())
        } catch VaultFileError.taken {
            call.reject("Something is already at that name.", "TAKEN")
        } catch VaultFileError.missing {
            call.reject("Nothing is there.", "MISSING")
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
