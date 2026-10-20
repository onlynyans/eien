// The one interface to a vault's files (spec §5). Implemented over the
// disk (platform/electron) and in memory (platform/memory, for tests); the
// same contract tests run against both.

import type { VaultEntry } from '../core/vault';

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

export interface Storage {
  /** Every visible folder and file, at any depth. Hidden (dot) names are left out. */
  list(): Promise<VaultEntry[]>;

  /** The file at `path`, or null when there's none. */
  read(path: string): Promise<FileState | null>;

  /**
   * Write `text` to `path`, only if the file is still at `expected`; with
   * `expected` null, only if there is no file there. The write is durable:
   * a crash leaves the old content or the new, never a mix.
   */
  write(path: string, text: string, expected: string | null): Promise<WriteResult>;

  /** Call `onChange` with the paths that changed; returns a function to stop. */
  watch(onChange: (paths: string[]) => void): () => void;
}
