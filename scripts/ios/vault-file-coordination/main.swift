// Tests for a save's last step on iOS (VaultFileOps.replace), run on a Mac
// with swiftc alone (npm run test:ios-files): another app editing the note
// in place, played by a file presenter as UIDocument is one, and the note's
// version counted as the window counts it. Each check names what a writer
// would lose if it failed.

import Foundation

var failures = 0
func check(_ ok: Bool, _ what: String) {
    print(ok ? "ok   \(what)" : "FAIL \(what)")
    if !ok { failures += 1 }
}

let root = FileManager.default.temporaryDirectory.appendingPathComponent("eien-coord-\(UUID().uuidString)")
try! FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: root) }
let at = { (name: String) in root.appendingPathComponent(name) }
let text = { (name: String) in try? String(contentsOf: at(name), encoding: .utf8) }
let there = { (name: String) in FileManager.default.fileExists(atPath: at(name).path) }
func put(_ words: String, _ name: String) { try! VaultFileOps.write(words, to: at(name)) }
func changed(_ step: () throws -> Void) -> Bool {
    do { try step(); return false } catch VaultFileError.changed { return true } catch { return false }
}

// The version, as the window's: TextDecoder (a broken character as U+FFFD, the byte-order mark
// kept), then SHA-256 of the UTF-8. Expected values from Node; a save refused for a version
// counted otherwise would never go through.
let versions: [(String, [UInt8], String)] = [
    ("plain words", Array("Words.".utf8), "44dcebcdcc564a642123c985ea211a70d843bbb02df908a1a46172c4ca15c11f"),
    ("a byte-order mark", [0xEF, 0xBB, 0xBF] + Array("Words.".utf8),
     "089c1ffabf23f2d7c144495f8ca3da4d769526b5c4ecf7601b1894a115004c71"),
    ("broken characters of every kind",
     [0x61, 0xE2, 0x82, 0x62, 0xFF, 0xF0, 0x9F, 0x98, 0x63, 0xED, 0xA0, 0x80, 0x64, 0xC0, 0xAF, 0x65,
      0xF4, 0x90, 0x80, 0x80],
     "a2289a11d4c336692165bfdc7571aaf5e403c5ea8d09c5b46c34606a9f6160e4"),
    ("a character cut by a crash", [0x43, 0x61, 0x66, 0xC3],
     "e908563323e86dafa580038c5d5f0716afd2a4daf3d07be4ceb63a510c5f3fae"),
]
for (what, bytes, expected) in versions {
    try Data(bytes).write(to: at("Version.md"))
    check(try VaultFileOps.version(of: at("Version.md")) == expected, "the window's version: \(what)")
}
check(try VaultFileOps.version(of: at("Nothing.md")) == nil, "no note, no version")

// The save's last step
put("Old words.", "Note.md")
let old = try VaultFileOps.version(of: at("Note.md"))
put("New words.", ".Note.md.0a1b2c3d.eien.tmp")
try VaultFileOps.replace(at(".Note.md.0a1b2c3d.eien.tmp"), to: at("Note.md"), expected: old)
check(text("Note.md") == "New words.", "a save replaces the note it read")
check(!there(".Note.md.0a1b2c3d.eien.tmp"), "and its temp file is gone")

put("A new note.", ".Fresh.md.0a1b2c3d.eien.tmp")
try VaultFileOps.replace(at(".Fresh.md.0a1b2c3d.eien.tmp"), to: at("Fresh.md"), expected: nil)
check(text("Fresh.md") == "A new note.", "a new note is made where there's none")

put("Mine.", ".Fresh.md.0a1b2c3d.eien.tmp")
check(changed { try VaultFileOps.replace(at(".Fresh.md.0a1b2c3d.eien.tmp"), to: at("Fresh.md"), expected: nil) },
      "a new note never replaces one that arrived meanwhile")
check(text("Fresh.md") == "A new note.", "which keeps its words")
check(text(".Fresh.md.0a1b2c3d.eien.tmp") == "Mine.", "and the save's words are still in its temp file")

put("Stale.", ".Note.md.0a1b2c3d.eien.tmp")
check(changed { try VaultFileOps.replace(at(".Note.md.0a1b2c3d.eien.tmp"), to: at("Note.md"), expected: old) },
      "a save over a note changed since it was read refuses")
check(text("Note.md") == "New words.", "and the note keeps its words")

// Another app with the note open, as UIDocument has it: a file presenter.
final class OtherApp: NSObject, NSFilePresenter {
    let presentedItemURL: URL?
    let presentedItemOperationQueue = OperationQueue()
    /// Typed there, not saved yet: saved when a coordinated writer asks first.
    var unsaved: String?
    let told = DispatchSemaphore(value: 0)
    init(_ url: URL) { presentedItemURL = url }
    func savePresentedItemChanges(completionHandler: @escaping (Error?) -> Void) {
        if let words = unsaved, let url = presentedItemURL {
            try? words.write(to: url, atomically: true, encoding: .utf8)
            unsaved = nil
        }
        completionHandler(nil)
    }
    func presentedItemDidChange() { told.signal() }
}

put("Before.", "Shared.md")
let before = try VaultFileOps.version(of: at("Shared.md"))
let typing = OtherApp(at("Shared.md"))
typing.unsaved = "Before. And a line typed in the other app."
NSFileCoordinator.addFilePresenter(typing)
put("Before. And a line typed in Eien.", ".Shared.md.0a1b2c3d.eien.tmp")
check(changed { try VaultFileOps.replace(at(".Shared.md.0a1b2c3d.eien.tmp"), to: at("Shared.md"), expected: before) },
      "an app with unsaved words saves them first, and Eien's save then refuses")
check(text("Shared.md") == "Before. And a line typed in the other app.", "so the other app's words are kept")
check(text(".Shared.md.0a1b2c3d.eien.tmp") == "Before. And a line typed in Eien.",
      "and Eien's are in its temp file, for the storage to keep as a copy")
NSFileCoordinator.removeFilePresenter(typing)

let reading = OtherApp(at("Shared.md"))
NSFileCoordinator.addFilePresenter(reading)
let current = try VaultFileOps.version(of: at("Shared.md"))
put("Both lines, and Eien's next.", ".Shared.md.0a1b2c3d.eien.tmp")
try VaultFileOps.replace(at(".Shared.md.0a1b2c3d.eien.tmp"), to: at("Shared.md"), expected: current)
check(reading.told.wait(timeout: .now() + 10) == .success,
      "an app with the note open is told of Eien's save, so it reads it rather than save over it")
NSFileCoordinator.removeFilePresenter(reading)

print(failures == 0 ? "All passed." : "\(failures) failed.")
exit(failures == 0 ? 0 : 1)
