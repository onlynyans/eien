// What this window wrote itself, so a change the disk reports can be told
// apart: the watcher hears every change, ours too. A change to a note that
// this window didn't make, a moment before, came from elsewhere: another
// device, through Syncthing, or another app (the sidebar's sync status).

import { isHiddenName } from '../../core/paths';
import { OWN_ECHO_MS, RecentWrites } from '../../core/vault/recent-writes';
import type { Bridge, VaultBridge } from '../../platform/bridge';

export { OWN_ECHO_MS };

export interface OwnWrites {
  /** The vault, its writes remembered. */
  readonly vault: VaultBridge;
  /**
   * Of the `paths` the disk reports changed, the notes neither this window
   * nor (`local`, as the main process says) another window on this device
   * changed: what came from elsewhere.
   */
  foreign(paths: Iterable<string>, local?: readonly string[]): string[];
}

export function ownWrites(vault: VaultBridge, now: () => number = Date.now): OwnWrites {
  const written = new RecentWrites(now);
  /** Until when everything is ours: an import writes many files, by the main process. */
  let importing = 0;
  const mark = (...paths: string[]) => written.mark(paths, true);
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
    writeNew: (path, bytes) => {
      mark(path);
      return vault.writeNew(path, bytes).finally(() => mark(path));
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
    foreign: (paths, local = []) =>
      now() < importing
        ? []
        : [...paths].filter(
            (path) =>
              !path.split('/').some(isHiddenName) &&
              path.endsWith('.md') &&
              !written.has(path) &&
              !local.includes(path),
          ),
  };
}

/** `given` with its vault's writes remembered; `onForeign` hears a change that came from elsewhere (returns a stop). */
export function withOwnWrites(given: Bridge): {
  readonly bridge: Bridge;
  onForeign(listener: () => void): () => void;
} {
  const own = ownWrites(given.vault);
  // The rest of the bridge as it is, methods and all: a spread would leave a class's behind.
  const bridge: Bridge = Object.create(given, { vault: { value: own.vault, enumerable: true } });
  return {
    bridge,
    onForeign: (listener) =>
      own.vault.onChange((paths, local) => {
        if (own.foreign(paths, local).length > 0) listener();
      }),
  };
}
