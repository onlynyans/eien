// What this window wrote itself, so a change the disk reports can be told
// apart: the watcher hears every change, ours too. A change to a note that
// this window didn't make, a moment before, came from elsewhere: another
// device, through Syncthing, or another app (the sidebar's sync status).

import { isHiddenName } from '../../core/paths';
import type { VaultBridge } from '../../platform/bridge';

/** How long after a write of ours its echo from the watcher may come. */
export const OWN_ECHO_MS = 5000;

export interface OwnWrites {
  /** The vault, its writes remembered. */
  readonly vault: VaultBridge;
  /** Of the `paths` the disk reports changed, those this window didn't change itself. */
  foreign(paths: Iterable<string>): string[];
}

export function ownWrites(vault: VaultBridge, now: () => number = Date.now): OwnWrites {
  /** Each path written, moved or trashed here, and when. */
  const written = new Map<string, number>();
  /** Until when everything is ours: an import writes many files, by the main process. */
  let importing = 0;
  const mark = (...paths: string[]) => {
    const at = now();
    for (const path of paths) written.set(path.normalize('NFC'), at);
  };
  const recent = (path: string) => {
    const at = path.normalize('NFC');
    for (const [own, when] of written) {
      if (now() - when > OWN_ECHO_MS) written.delete(own);
      else if (at === own || at.startsWith(`${own}/`)) return true;
    }
    return false;
  };
  // Every call named: the bridge may be a class, whose methods a spread would leave behind.
  const tracked: VaultBridge = {
    current: () => vault.current(),
    choose: () => vault.choose(),
    list: () => vault.list(),
    notes: () => vault.notes(),
    search: (query, within) => vault.search(query, within),
    listFiles: (folder) => vault.listFiles(folder),
    read: (path) => vault.read(path),
    readBytes: (path) => vault.readBytes(path),
    onChange: (listener) => vault.onChange(listener),
    write: (path, text, expected) => {
      mark(path);
      return vault.write(path, text, expected).finally(() => mark(path));
    },
    move: (from, to) => {
      mark(from, to);
      return vault.move(from, to).finally(() => mark(from, to));
    },
    trash: (path) => {
      mark(path);
      return vault.trash(path).finally(() => mark(path));
    },
    makeFolder: (path) => {
      mark(path);
      return vault.makeFolder(path);
    },
    importFolder: () => {
      importing = Number.POSITIVE_INFINITY;
      return vault.importFolder().finally(() => {
        importing = now() + OWN_ECHO_MS;
      });
    },
  };
  return {
    vault: tracked,
    foreign: (paths) =>
      now() < importing
        ? []
        : [...paths].filter(
            (path) => !path.split('/').some(isHiddenName) && path.endsWith('.md') && !recent(path),
          ),
  };
}
