// Adversarial checks of ios/App/App/VaultFileOps.swift, run on a Mac with
// swiftc alone, as scripts/ios/vault-file-ops-test is:
//   swiftc -O ios/App/App/VaultFileOps.swift scripts/ios/vault-file-ops-adversarial/main.swift \
//     -o out/vault-file-ops-adversarial && out/vault-file-ops-adversarial
// The moments a phone meets that the plain tests don't: a long note, many
// failures in a row, a name in the other Unicode form, links at the new name.
// Each check names what a writer would lose if it failed. All pass today: the
// defects found in phase 10c are in the wiring around these calls (see
// tests/ios-wiring.test.ts and src/platform/capacitor/adversarial-ios.test.ts).

import Foundation

var failures = 0
func check(_ ok: Bool, _ what: String) {
    print(ok ? "ok   \(what)" : "FAIL \(what)")
    if !ok { failures += 1 }
}

let fm = FileManager.default
let root = fm.temporaryDirectory.appendingPathComponent("eien-ops-adv-\(UUID().uuidString)")
try! fm.createDirectory(at: root, withIntermediateDirectories: true)
defer { try? fm.removeItem(at: root) }
let at = { (name: String) in root.appendingPathComponent(name) }
let text = { (name: String) in try? String(contentsOf: at(name), encoding: .utf8) }
let openDescriptors = { (try? fm.contentsOfDirectory(atPath: "/dev/fd").count) ?? -1 }

// A long note goes in whole, however the system splits the write.
let long = String(repeating: "A line of a very long book — 永. ", count: 2_000_000) // ~70 MB
try VaultFileOps.write(long, to: at("Long.md"))
check(text("Long.md") == long, "a 70 MB note is written whole, not the first part of it")

// Failures in a row leave no file open: a phone that runs out of descriptors saves nothing.
let before = openDescriptors()
for _ in 0..<500 {
    _ = try? VaultFileOps.write("x", to: at("missing/Note.md"))
    _ = try? VaultFileOps.rename(at("missing.md"), to: at("Elsewhere.md"), replace: true)
    _ = try? VaultFileOps.rename(at("Long.md"), to: at("missing/Long.md"), replace: false)
}
check(openDescriptors() == before, "500 failed writes and renames leave no descriptor open")

// One name in two Unicode forms is one file on APFS (iOS's and this Mac's): a move refuses it.
let composed = "Caf\u{E9}.md", decomposed = "Cafe\u{301}.md"
try VaultFileOps.write("The café scene.", to: at(composed))
try VaultFileOps.write("Another note.", to: at("Other.md"))
do {
    try VaultFileOps.rename(at("Other.md"), to: at(decomposed), replace: false)
    check(false, "a move onto the other Unicode form of a note's name refuses")
} catch VaultFileError.taken {
    check(text(composed) == "The café scene.", "a move onto the other Unicode form of a note's name refuses")
}

// A link at the new name is something there, even one that leads nowhere.
try fm.createSymbolicLink(atPath: at("Research").path, withDestinationPath: "/Users/writer/Dropbox/Research")
do {
    try VaultFileOps.rename(at("Other.md"), to: at("Research"), replace: false)
    check(false, "a move onto a link to nothing refuses")
} catch VaultFileError.taken {
    check(text("Other.md") == "Another note.", "a move onto a link to nothing refuses")
}

// A save's rename over a note that's a link replaces the link: the linked file keeps its words.
try VaultFileOps.write("The linked file's words.", to: at("Linked target.md"))
try fm.createSymbolicLink(atPath: at("Linked.md").path, withDestinationPath: at("Linked target.md").path)
try VaultFileOps.write("The save.", to: at(".Linked.md.eien.tmp"))
try VaultFileOps.rename(at(".Linked.md.eien.tmp"), to: at("Linked.md"), replace: true)
check(text("Linked target.md") == "The linked file's words.", "a save over a link never writes through it")
check(text("Linked.md") == "The save.", "and the note is the save")

// A folder never takes an empty folder's name when the move mustn't replace.
try fm.createDirectory(at: at("Book"), withIntermediateDirectories: false)
try VaultFileOps.write("A chapter.", to: at("Book/Chapter.md"))
try fm.createDirectory(at: at("Empty"), withIntermediateDirectories: false)
do {
    try VaultFileOps.rename(at("Book"), to: at("Empty"), replace: false)
    check(false, "a folder never takes an empty folder's name")
} catch VaultFileError.taken {
    check(text("Book/Chapter.md") == "A chapter.", "a folder never takes an empty folder's name")
}

print(failures == 0 ? "All passed." : "\(failures) failed.")
exit(failures == 0 ? 0 : 1)
