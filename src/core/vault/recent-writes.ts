// What was written a moment ago, and by whom. The watcher hears every change,
// a write's own too: a change it reports soon after a write is that write's
// echo, not news from elsewhere. One rule for a window's own writes
// (ui/vault/own-writes.ts) and for the main process, which tells each window
// what another window on this device wrote (app/electron/vaults.ts).

import { isInside } from '../paths';

/** How long after a write its echo from the watcher may come. */
export const OWN_ECHO_MS = 5000;

export class RecentWrites<Who = true> {
  /** Each path written, moved or trashed, when, and by whom. */
  readonly #written = new Map<string, { at: number; by: Who }>();
  readonly #now: () => number;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  /** `paths` were written, moved or trashed just now, `by` someone. */
  mark(paths: Iterable<string>, by: Who): void {
    const at = this.#now();
    for (const path of paths) this.#written.set(path.normalize('NFC'), { at, by });
  }

  /**
   * Whether `path`, or a folder holding it, was written within the echo, by
   * anyone but `unless`. What's older is forgotten as it's passed.
   */
  has(path: string, unless?: Who): boolean {
    const at = path.normalize('NFC');
    const now = this.#now();
    let found = false;
    for (const [own, write] of this.#written) {
      if (now - write.at > OWN_ECHO_MS) this.#written.delete(own);
      else if (!found && write.by !== unless && isInside(at, own)) {
        found = true;
      }
    }
    return found;
  }
}
