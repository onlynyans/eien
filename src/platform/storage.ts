// The one interface to a vault's files (spec §5). Implemented over the
// disk (platform/electron), the phone's (platform/capacitor) and in memory
// (platform/memory, for tests); the same contract tests run against each.
// None makes a case twin: a name its folder has in another case
// (./case-twin.ts), which a system that ignores case couldn't hold.

import { MAX_IMAGE_BYTES, type VaultEntry } from '../core/vault';

/** A file's text as stored (BOM and line endings as found) and its version. */
export interface FileState {
  readonly text: string;
  /** Changes whenever the content changes; opaque otherwise. */
  readonly version: string;
}

export type WriteResult =
  | { readonly ok: true; readonly version: string }
  /** The file isn't at the version the write expected: nothing was written. */
  | { readonly ok: false; readonly current: FileState | null };

/** What a move did: done, or why it wasn't. */
export type MoveResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      /** Nothing at `from`; something else at `to`; or a folder moving into itself. */
      readonly reason: 'missing' | 'taken' | 'into-itself';
    };

/** The largest file readBytes returns (an image shown in a note). */
export const MAX_BYTES_READ = MAX_IMAGE_BYTES;

export interface Storage {
  /** Every visible folder and file, at any depth. Hidden (dot) names are left out. */
  list(): Promise<VaultEntry[]>;

  /**
   * The names of the files directly in the folder at `folder` (a hidden one
   * too, such as .eien/versions/<id>), leaving out hidden files (a write's
   * temp file), folders and links; none when there's no folder there.
   */
  listFiles(folder: string): Promise<string[]>;

  /** The file at `path`, or null when there's none. */
  read(path: string): Promise<FileState | null>;

  /** The bytes of the file at `path` (an image), or null when there's none or it's too big. */
  readBytes(path: string): Promise<Uint8Array | null>;

  /**
   * Write `text` to `path`, only if the file is still at `expected`; with
   * `expected` null, only if there is no file there, nor a case twin (then
   * `current` is what's there, or the twin). The write is durable: a crash
   * leaves the old content or the new, never a mix.
   */
  write(path: string, text: string, expected: string | null): Promise<WriteResult>;

  /**
   * Write `bytes` as a new file at `path` (an imported image), making the
   * folders above it, only where nothing is: false, and nothing written, when
   * something is there already (a case twin too), even something that arrived
   * a moment before.
   * Durable as `write` is: a crash leaves no file or the whole one.
   */
  writeNew(path: string, bytes: Uint8Array): Promise<boolean>;

  /**
   * Move or rename the file or folder at `from` to `to`, making the folders
   * above `to`. Refused when there's nothing at `from`, something else is at
   * `to` (a case twin too), or a folder would move into itself. A rename that
   * changes only case is the same file, and allowed.
   */
  move(from: string, to: string): Promise<MoveResult>;

  /**
   * Send the file or folder at `path` to the system's trash, where the writer
   * can take it back. Throws when it can't; then nothing is removed.
   */
  trash(path: string): Promise<void>;

  /**
   * Make the folder at `path`, and any above it. One already there is fine; a file there, or
   * a case twin, throws.
   */
  makeFolder(path: string): Promise<void>;

  /**
   * Call `onChange` with the paths that changed; returns a function to stop.
   * `ready` is called once, when what changes from then on will be told: a
   * look at the vault after it misses nothing between it and the watcher.
   */
  watch(onChange: (paths: string[]) => void, ready?: () => void): () => void;
}
