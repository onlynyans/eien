// The vault's watcher on the disk (Storage.watch): the system's own, for
// the whole folder, its reports gathered into bursts.

import { type FSWatcher, watch } from 'node:fs';
import { sep } from 'node:path';
import { isWatchedPath } from '../../core/paths';

/** Bursts of changes are reported together, this long after the first. */
const WATCH_SETTLE_MS = 120;

/**
 * How long the system's watcher is given before it's taken to be listening:
 * fs.watch says nothing when it is, and macOS's misses its first moments.
 */
const WATCH_WARM_MS = 1000;

/** Call `onChange` with the vault paths that changed under `root`; returns a function to stop. */
export function watchFolder(
  root: string,
  onChange: (paths: string[]) => void,
  ready?: () => void,
): () => void {
  let pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const warm = ready ? setTimeout(ready, WATCH_WARM_MS) : undefined;
  let watcher: FSWatcher | undefined;
  try {
    watcher = watch(root, { recursive: true }, (_event, name) => {
      if (!name) return;
      const path = name.split(sep).join('/');
      if (!isWatchedPath(path)) return; // our temp files, dot-files, .eien but its settings
      pending.add(path);
      // A burst is told WATCH_SETTLE_MS after its first change, with all that changed
      // meanwhile. Waiting for quiet instead would let one file written without pause
      // (a sync tool's download, another app's autosave) hold every report back.
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        const paths = [...pending];
        pending = new Set();
        onChange(paths);
      }, WATCH_SETTLE_MS);
    });
    watcher.on('error', () => watcher?.close());
  } catch {
    // No watching on this system: changes are seen on the next read.
  }
  return () => {
    clearTimeout(timer);
    clearTimeout(warm);
    watcher?.close();
  };
}
