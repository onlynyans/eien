// Tests for ios/App/App/VaultFileOps.swift, run on a Mac with swiftc alone
// (npm run test:ios-files): the same Darwin calls as on the phone. Each
// check names what a writer would lose if it failed.

import Foundation

var failures = 0
func check(_ ok: Bool, _ what: String) {
    print(ok ? "ok   \(what)" : "FAIL \(what)")
    if !ok { failures += 1 }
}

let root = FileManager.default.temporaryDirectory.appendingPathComponent("eien-ops-\(UUID().uuidString)")
try! FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: root) }
let at = { (name: String) in root.appendingPathComponent(name) }
let text = { (name: String) in try? String(contentsOf: at(name), encoding: .utf8) }

// write
try VaultFileOps.write("The scarf caught on the gate.", to: at("Tear.md"))
check(text("Tear.md") == "The scarf caught on the gate.", "a write's words are in the file")
try VaultFileOps.write("Shorter.", to: at("Tear.md"))
check(text("Tear.md") == "Shorter.", "a shorter write leaves nothing of the longer one")
try VaultFileOps.write("", to: at("Empty.md"))
check(text("Empty.md") == "", "an empty note is written")
try VaultFileOps.write("“Curly” — 永 — 🧣", to: at("Unicode.md"))
check(text("Unicode.md") == "“Curly” — 永 — 🧣", "any character, as UTF-8")
do {
    try VaultFileOps.write("x", to: at("missing folder/Note.md"))
    check(false, "a write into a folder that isn't there refuses")
} catch { check(true, "a write into a folder that isn't there refuses") }

// rename, replacing: a save's temp file over its note
try VaultFileOps.write("New words.", to: at(".Tear.md.eien.tmp"))
try VaultFileOps.rename(at(".Tear.md.eien.tmp"), to: at("Tear.md"), replace: true)
check(text("Tear.md") == "New words.", "a save's rename replaces the note")
check(!FileManager.default.fileExists(atPath: at(".Tear.md.eien.tmp").path), "and the temp file is gone")
do {
    try VaultFileOps.rename(at("nothing here.md"), to: at("Tear.md"), replace: true)
    check(false, "a rename that fails says so")
} catch {
    check(text("Tear.md") == "New words.", "a rename that fails leaves the note as it was")
}
try FileManager.default.createDirectory(at: at("Fic"), withIntermediateDirectories: false)
try VaultFileOps.write("A file.", to: at("Over.md"))
do {
    try VaultFileOps.rename(at("Over.md"), to: at("Fic"), replace: true)
    check(false, "a file never replaces a folder")
} catch { check(text("Over.md") == "A file.", "a file never replaces a folder") }

// rename, never replacing: moves, the trash, recovery
try VaultFileOps.write("Synced in from the laptop.", to: at("Chapter.md"))
try VaultFileOps.write("Mine.", to: at("Draft.md"))
do {
    try VaultFileOps.rename(at("Draft.md"), to: at("Chapter.md"), replace: false)
    check(false, "a move onto a name that's taken refuses")
} catch VaultFileError.taken {
    check(text("Chapter.md") == "Synced in from the laptop.", "a move never replaces a note there")
    check(text("Draft.md") == "Mine.", "and the moved note stays where it was")
}
try VaultFileOps.rename(at("Draft.md"), to: at("Fic/Draft.md"), replace: false)
check(text("Fic/Draft.md") == "Mine.", "a move to a free name, in another folder")
try VaultFileOps.rename(at("Fic"), to: at("Book"), replace: false)
check(text("Book/Draft.md") == "Mine.", "a folder moves with what's in it")
try FileManager.default.createDirectory(at: at("Taken"), withIntermediateDirectories: false)
do {
    try VaultFileOps.rename(at("Book"), to: at("Taken"), replace: false)
    check(false, "a folder never takes a folder's name")
} catch VaultFileError.taken { check(text("Book/Draft.md") == "Mine.", "a folder never takes a folder's name") }

// A case-only rename in two steps, as the storage makes it: never a name that's there.
try VaultFileOps.write("Words.", to: at("tear-case.md"))
try VaultFileOps.rename(at("tear-case.md"), to: at(".tear-case.md.eien-case"), replace: false)
try VaultFileOps.rename(at(".tear-case.md.eien-case"), to: at("Tear-case.md"), replace: false)
check(text("Tear-case.md") == "Words.", "a rename that only changes case, in two steps")

print(failures == 0 ? "All passed." : "\(failures) failed.")
exit(failures == 0 ? 0 : 1)
