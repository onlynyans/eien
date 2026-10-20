// What the phone's storage needs of a file system: a few plain calls on
// paths inside the vault ("" is the vault itself). Capacitor's Filesystem
// plugin gives them on the phone (./capacitor-files.ts); Node's fs gives
// them in tests (./node-files.ts), so the storage's contract tests run on it.

/** A file or folder, as a listing or a stat tells it. */
export interface FileEntry {
  readonly name: string;
  readonly type: 'file' | 'directory';
  /** Bytes; 0 for folders. */
  readonly size: number;
  /** Last modified, in milliseconds since 1970. */
  readonly mtime: number;
}

export interface FilesPort {
  /** The file's text (UTF-8), or null when there's no file there. */
  readText(path: string): Promise<string | null>;
  /** The file's bytes, or null when there's no file there. */
  readBytes(path: string): Promise<Uint8Array | null>;
  /** Write `text` (UTF-8) to the file, replacing one there; its folder must exist. */
  writeText(path: string, text: string): Promise<void>;
  /** The file or folder at `path`, or null when there's nothing there. */
  stat(path: string): Promise<FileEntry | null>;
  /** What's directly in the folder at `folder`; null when there's no folder there. */
  list(folder: string): Promise<FileEntry[] | null>;
  /** Rename a file or folder; a file at `to` is replaced, a folder at `to` refuses. */
  rename(from: string, to: string): Promise<void>;
  /** Make the folder and any above it; one already there is fine. */
  makeFolder(path: string): Promise<void>;
  /** Remove the file at `path`. */
  remove(path: string): Promise<void>;
}

/** The folder a vault path is in ("" for the vault itself). */
export const folderOf = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

/** The last name of a vault path. */
export const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
