// The vault's writes, renames and listings on iOS (spec §3), where the
// Filesystem plugin falls short of the storage's contract: its write isn't
// flushed to the disk; its rename deletes the file it replaces before
// moving, so a rename that fails loses both; and its listing follows links,
// so one link to nothing fails the whole folder as though it weren't there.
// A save's last step is a coordinated write, as apps that edit a note in
// place through the Files app expect (`replace`). Plain Foundation, Darwin
// and CryptoKit, with nothing of Capacitor's, so scripts/ios/ tests them with
// swiftc alone (npm run test:ios-files). The plugin is VaultFilesPlugin.swift.

import CryptoKit
import Foundation

enum VaultFileError: Error, Equatable {
    /// Something is at the new name already (a rename that mustn't replace).
    case taken
    /// No folder there to list.
    case missing
    /// The note isn't at the version the save expected: it changed meanwhile.
    case changed
    case system(String)
}

/// One entry of a folder, as itself: never what a link leads to.
struct VaultEntry: Equatable {
    let name: String
    let directory: Bool
    /// Bytes; 0 for folders.
    let size: Int
    /// Last modified, in milliseconds since 1970.
    let mtime: Double
}

enum VaultFileOps {
    /// `text` as UTF-8 in the file at `url`, replacing one there, flushed to the disk before returning.
    static func write(_ text: String, to url: URL) throws {
        let fd = open(url.path, O_WRONLY | O_CREAT | O_TRUNC, 0o644)
        guard fd >= 0 else { throw failure() }
        defer { close(fd) }
        let bytes = Array(text.utf8)
        var done = 0
        while done < bytes.count {
            let wrote = bytes.withUnsafeBytes { buffer in
                Darwin.write(fd, buffer.baseAddress! + done, bytes.count - done)
            }
            if wrote < 0 {
                if errno == EINTR { continue }
                throw failure()
            }
            done += wrote
        }
        try flush(fd)
    }

    /// `from` to `to` in one step. With `replace`, a file at `to` is replaced (rename(2)), never
    /// deleted first, so if it fails both are as they were; a folder at `to` refuses. Without,
    /// a name that's taken, by any case the volume ignores, refuses: `taken` (RENAME_EXCL).
    static func rename(_ from: URL, to: URL, replace: Bool) throws {
        let result = replace
            ? Darwin.rename(from.path, to.path)
            : renamex_np(from.path, to.path, UInt32(RENAME_EXCL))
        if result != 0 {
            if !replace && errno == EEXIST { throw VaultFileError.taken }
            throw failure()
        }
        // The rename flushed too, where the volume can flush a folder.
        let folder = open(to.deletingLastPathComponent().path, O_RDONLY)
        if folder >= 0 {
            _ = try? flush(folder)
            close(folder)
        }
    }

    /// A save's temp file `from` over its note at `to` (as `rename` replacing), only while the
    /// note is at `expected`, its `version` (nil: no note there); `changed`, and nothing done,
    /// when it isn't. A coordinated write (NSFileCoordinator): another app editing the note in
    /// place saves its own changes first (`forMerging` asks that; `forReplacing` doesn't), so
    /// they're looked at here and never written over, and it's told of this one, so it reads
    /// the note again rather than save its old words over it.
    static func replace(_ from: URL, to: URL, expected: String?) throws {
        var coordination: NSError?
        var outcome: Result<Void, Error> = .success(())
        NSFileCoordinator(filePresenter: nil).coordinate(
            writingItemAt: to, options: .forMerging, error: &coordination
        ) { note in
            outcome = Result {
                guard try version(of: note) == expected else { throw VaultFileError.changed }
                try rename(from, to: note, replace: true)
            }
        }
        if let coordination { throw VaultFileError.system(coordination.localizedDescription) }
        try outcome.get()
    }

    /// The note's version as the window counts it (capacitor-storage.ts): the SHA-256, in hex,
    /// of its words as UTF-8, read with a broken character as U+FFFD and a byte-order mark
    /// kept. Nil when there's no file.
    static func version(of url: URL) throws -> String? {
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile {
            return nil
        }
        let words = String(decoding: data, as: UTF8.self)
        return SHA256.hash(data: Data(words.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// What's directly in `folder`: files and folders, each as itself (lstat). A link, which may
    /// lead nowhere, is left out, as the desktop leaves it out; one gone since the listing too.
    static func list(_ folder: URL) throws -> [VaultEntry] {
        var isFolder: ObjCBool = false
        guard FileManager.default.fileExists(atPath: folder.path, isDirectory: &isFolder),
              isFolder.boolValue
        else { throw VaultFileError.missing }
        let names = try FileManager.default.contentsOfDirectory(atPath: folder.path)
        return names.compactMap { name in
            var info = stat()
            guard lstat(folder.appendingPathComponent(name).path, &info) == 0 else { return nil }
            let kind = info.st_mode & S_IFMT
            guard kind == S_IFDIR || kind == S_IFREG else { return nil }
            let time = info.st_mtimespec
            return VaultEntry(
                name: name,
                directory: kind == S_IFDIR,
                size: kind == S_IFDIR ? 0 : Int(info.st_size),
                mtime: Double(time.tv_sec) * 1000 + Double(time.tv_nsec) / 1_000_000
            )
        }
    }

    /// To the disk itself (F_FULLFSYNC), not only out of the process; fsync where that's refused.
    private static func flush(_ fd: Int32) throws {
        if fcntl(fd, F_FULLFSYNC) == 0 { return }
        if fsync(fd) != 0 { throw failure() }
    }

    private static func failure() -> VaultFileError {
        .system(String(cString: strerror(errno)))
    }
}
