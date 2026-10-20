// What a vault holds, as the storage lists it.

import { isHiddenName } from '../paths';

export type EntryKind = 'note' | 'folder' | 'file';

export interface VaultEntry {
  /** Vault-relative, "/" separated. */
  readonly path: string;
  readonly kind: EntryKind;
  /** Last modified, in milliseconds since 1970. */
  readonly modified: number;
  /** Bytes; 0 for folders. */
  readonly size: number;
}

/** A note is a visible ".md" file (spec §2). */
export const isNoteName = (name: string): boolean =>
  !isHiddenName(name) && name.toLowerCase().endsWith('.md');

/** The kind a listed file or folder is. */
export const kindOf = (name: string, isFolder: boolean): EntryKind =>
  isFolder ? 'folder' : isNoteName(name) ? 'note' : 'file';

/**
 * Syncthing's copy of a file both devices changed:
 * "Note.sync-conflict-20261019-164012-ABCDEFG.md" beside "Note.md".
 */
const SYNC_CONFLICT = /\.sync-conflict-\d{8}-\d{6}-[A-Z0-9]{7}(\.[^.]*)?$/;

export const isSyncConflictName = (name: string): boolean => SYNC_CONFLICT.test(name);

/** For a Syncthing conflict copy, the name of the note it belongs beside. */
export const syncConflictOf = (name: string): string | null => {
  const match = SYNC_CONFLICT.exec(name);
  return match ? name.slice(0, match.index) + (match[1] ?? '') : null;
};
