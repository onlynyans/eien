// A phone has no file watcher for the vault: it's looked at again every few
// seconds while the app is in front, and at once when it comes back
// (lookNow), each file by its time and size. What changed since the last
// look is reported, as a watcher would report it.

import { isHiddenName, isWatchedPath } from '../../core/paths';
import type { FilesPort } from './files';

const joined = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);

export class Poller {
  readonly #files: FilesPort;
  readonly #pollMs: number;
  /** Whether to look now: false while the app is in the background. */
  readonly #active: () => boolean;
  /** Each watcher's look, to be run now (the app back in front). */
  readonly #lookers = new Set<() => void>();

  constructor(files: FilesPort, pollMs: number, active: () => boolean) {
    this.#files = files;
    this.#pollMs = pollMs;
    this.#active = active;
  }

  /** `ready` once the first look is done: what changes after it is told. */
  watch(onChange: (paths: string[]) => void, ready?: () => void): () => void {
    let last: Map<string, string> | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let looking = false;
    const look = async () => {
      if (stopped || looking) return;
      looking = true;
      clearTimeout(timer);
      try {
        if (this.#active()) {
          const now = await this.#snapshot().catch(() => null);
          if (now && last) {
            const changed = [...new Set([...last.keys(), ...now.keys()])].filter(
              (path) => last?.get(path) !== now.get(path),
            );
            if (changed.length > 0 && !stopped) onChange(changed);
          }
          if (now && !last) ready?.();
          if (now) last = now;
        }
      } finally {
        looking = false;
        if (!stopped) timer = setTimeout(() => void look(), this.#pollMs);
      }
    };
    const lookNow = () => void look();
    this.#lookers.add(lookNow);
    void look();
    return () => {
      stopped = true;
      clearTimeout(timer);
      this.#lookers.delete(lookNow);
    };
  }

  /** Look for changes now. */
  lookNow(): void {
    for (const look of this.#lookers) look();
  }

  /** What a watcher reports changes in (isWatchedPath), each by its time and size. */
  async #snapshot(): Promise<Map<string, string>> {
    const seen = new Map<string, string>();
    const walk = async (folder: string): Promise<void> => {
      for (const entry of (await this.#files.list(folder)) ?? []) {
        const path = joined(folder, entry.name);
        if (entry.type === 'directory') {
          // Into the vault's folders, and .eien's settings and seals; not its trash, nor other hidden folders.
          const hidden = path.split('/').some(isHiddenName);
          if (!hidden || path === '.eien' || path.startsWith('.eien/versions')) await walk(path);
        } else if (isWatchedPath(path)) {
          seen.set(path, `${entry.mtime}:${entry.size}`);
        }
      }
    };
    await walk('');
    return seen;
  }
}
