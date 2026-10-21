// The vault's writes and renames on iOS (spec §3), where the Filesystem
// plugin falls short of the storage's contract: its write isn't flushed to
// the disk, and its rename deletes the file it replaces before moving, so a
// rename that fails loses both. Plain Foundation and Darwin, with nothing of
// Capacitor's, so scripts/ios/vault-file-ops-test/main.swift tests them with
// swiftc alone (npm run test:ios-files). The plugin is VaultFilesPlugin.swift.

import Foundation

enum VaultFileError: Error, Equatable {
    /// Something is at the new name already (a rename that mustn't replace).
    case taken
    case system(String)
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

    /// To the disk itself (F_FULLFSYNC), not only out of the process; fsync where that's refused.
    private static func flush(_ fd: Int32) throws {
        if fcntl(fd, F_FULLFSYNC) == 0 { return }
        if fsync(fd) != 0 { throw failure() }
    }

    private static func failure() -> VaultFileError {
        .system(String(cString: strerror(errno)))
    }
}
