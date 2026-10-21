// What the phone's storage needs of a file system: a few plain calls on
// paths inside the vault ("" is the vault itself). Capacitor's Filesystem
// plugin gives them on the phone (./capacitor-files.ts); Node's fs gives
// them in tests (./node-files.ts), so the storage's contract tests run on it.

import { hiddenBeside } from '../stray';

/** A file or folder, as a listing or a stat tells it. */
export interface FileEntry {
  readonly name: string;
  readonly type: 'file' | 'directory';
  /** Bytes; 0 for folders. */
  readonly size: number;
  /** Last modified, in milliseconds since 1970. */
  readonly mtime: number;
}

/** Thrown by `renameNew` when something is at the new name already. */
export class TakenError extends Error {
  constructor(path: string) {
    super(`Something is already at ${path}.`);
    this.name = 'TakenError';
  }
}

/** Thrown by `replace` when the file isn't at the version expected: nothing was done. */
export class ChangedError extends Error {
  constructor(path: string) {
    super(`${path} changed meanwhile.`);
    this.name = 'ChangedError';
  }
}

/**
 * Each call says what it does when it can't: null only means nothing is
 * there; any other failure (to read, to look) throws, so a storage never
 * takes "couldn't look" for "nothing there" and writes over a file.
 */
export interface FilesPort {
  /** The file's text (UTF-8), or null when there's no file there. */
  readText(path: string): Promise<string | null>;
  /** The file's bytes, or null when there's no file there. */
  readBytes(path: string): Promise<Uint8Array | null>;
  /**
   * Write `text` (UTF-8; a lone surrogate as U+FFFD, as TextEncoder writes it) to the file,
   * replacing one there, and flush it to the disk before resolving. Its folder must exist.
   */
  writeText(path: string, text: string): Promise<void>;
  /** Write `bytes` to the file, replacing one there (an export: an EPUB, a Word file). Its folder must exist. */
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  /** The file or folder at `path`, or null when there's nothing there. */
  stat(path: string): Promise<FileEntry | null>;
  /** What's directly in the folder at `folder`; null when there's no folder there. */
  list(folder: string): Promise<FileEntry[] | null>;
  /**
   * Rename a file onto `to` in one step, replacing a file there: never deleting it first, so
   * if the rename fails both are as they were. A folder at `to` refuses.
   */
  rename(from: string, to: string): Promise<void>;
  /**
   * Where the system coordinates writes with other apps (iOS): rename as `rename` does, as a
   * coordinated write, only while the file at `to` is at `version` (the storage's, of its
   * text; null: no file there), looked at inside the coordination; ChangedError, and nothing
   * done, when it isn't. Another app editing the file in place saves first, and is told.
   */
  replace?(from: string, to: string, version: string | null): Promise<void>;
  /**
   * Rename a file or folder to a name nothing has: TakenError when something is there (by any
   * case the system ignores), looked at as close to the rename as the system allows. A name
   * another entry has in another case, the storage refuses itself (../case-twin.ts).
   */
  renameNew(from: string, to: string): Promise<void>;
  /** Make the folder and any above it; one already there, or made at the same moment, is fine. */
  makeFolder(path: string): Promise<void>;
  /** Remove the file at `path`. */
  remove(path: string): Promise<void>;
}

/** The folder a vault path is in ("" for the vault itself). */
export const folderOf = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

/** The last name of a vault path. */
export const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** The hidden file beside `path` named for `suffix` (a write's temp file, a rename's step). */
export const besidePath = (path: string, suffix: string): string => {
  const folder = folderOf(path);
  const name = hiddenBeside(nameOf(path), suffix);
  return folder ? `${folder}/${name}` : name;
};
