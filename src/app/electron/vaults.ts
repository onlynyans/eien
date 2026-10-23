// The vaults the windows have open. Each folder is opened once, however many
// windows show it: one index and one watcher serve them all, so the folder is
// read and watched once. A crash's leftovers are recovered when the first
// window opens it, never while another window is writing there (its temp
// files would look like a crash's). And each window hears which changes
// another window on this device made, so it doesn't take them for a sync.

import { realpath } from 'node:fs/promises';
import { RecentWrites } from '../../core/vault/recent-writes';
import type { OpenVault } from '../../platform/open-vault';

/** A folder opened: its vault, its real path, and whether Syncthing syncs it. */
export interface Opened {
  readonly vault: OpenVault;
  readonly root: string;
  readonly syncthing: boolean;
}

/** One window's hold on a vault. */
export interface VaultHold extends Opened {
  /** `paths` were just written, moved or trashed by this window. */
  wrote(paths: readonly string[]): void;
  /** Let go: the last window to let go stops watching the folder. */
  release(): void;
}

/** Hears the paths that changed, and of those, the ones another window here wrote. */
export type Heard = (paths: string[], local: string[]) => void;

interface Shared {
  /** The folder opened, once (two windows asking at once share the one opening). */
  readonly opened: Promise<Opened>;
  /** Every window holding it, or about to: the folder is let go when none is. */
  readonly holders: Map<symbol, Heard>;
  readonly written: RecentWrites<symbol>;
  stop: () => void;
}

export class Vaults {
  readonly #shared = new Map<string, Shared>();
  readonly #open: (root: string) => Promise<Opened>;
  readonly #resolve: (root: string) => Promise<string>;
  readonly #now: () => number;

  /**
   * `open` opens a folder (recovering what a crash left, reading it); `resolve`
   * gives a folder's real path, so two names for one folder are one vault.
   */
  constructor(
    open: (root: string) => Promise<Opened>,
    resolve: (root: string) => Promise<string> = realpath,
    now: () => number = Date.now,
  ) {
    this.#open = open;
    this.#resolve = resolve;
    this.#now = now;
  }

  /** Hold the vault in `root` for one window, which hears its changes through `heard`. */
  async hold(root: string, heard: Heard): Promise<VaultHold> {
    const key = await this.#resolve(root);
    const shared = this.#shared.get(key) ?? this.#start(key);
    const me = Symbol('window');
    shared.holders.set(me, heard); // held before the wait, so a release meanwhile keeps it open
    let opened: Opened;
    try {
      opened = await shared.opened;
    } catch (error) {
      this.#letGo(key, shared, me);
      throw error;
    }
    let held = true;
    return {
      ...opened,
      wrote: (paths) => shared.written.mark(paths, me),
      release: () => {
        if (!held) return;
        held = false;
        this.#letGo(key, shared, me);
      },
    };
  }

  /** How many folders are open now (one per vault, however many windows show it). */
  get size(): number {
    return this.#shared.size;
  }

  #start(key: string): Shared {
    const shared: Shared = {
      opened: this.#open(key),
      holders: new Map(),
      written: new RecentWrites<symbol>(this.#now),
      stop: () => {},
    };
    this.#shared.set(key, shared);
    shared.opened.then(
      ({ vault }) => {
        if (this.#shared.get(key) !== shared) return; // let go before it was read
        shared.stop = vault.watch((paths) => {
          for (const [holder, heard] of shared.holders) {
            heard(
              paths,
              paths.filter((path) => shared.written.has(path, holder)),
            );
          }
        });
      },
      () => {},
    );
    return shared;
  }

  #letGo(key: string, shared: Shared, me: symbol): void {
    shared.holders.delete(me);
    if (shared.holders.size > 0 || this.#shared.get(key) !== shared) return;
    this.#shared.delete(key);
    shared.stop();
  }
}
