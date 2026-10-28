// Changes another program (or device) made, as the window hears of them:
// in bursts, settled before anything redraws.

import { isInside } from '../../core/paths';
import type { VaultBridge } from '../../platform/bridge';

/** Changes from disk arrive in bursts; the panes redraw once they settle. */
const SETTLE_MS = 150;

/** Call `settled` with every path changed in a burst, once it's over; returns a function to stop. */
export function onDiskChanges(
  vault: Pick<VaultBridge, 'onChange'>,
  settled: (changed: Set<string>) => void,
): () => void {
  let pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = vault.onChange((paths) => {
    for (const path of paths) pending.add(path);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const changed = pending;
      pending = new Set();
      settled(changed);
    }, SETTLE_MS);
  });
  return () => {
    stop();
    clearTimeout(timer);
  };
}

/**
 * Whether a change touches the note at `path`: the note itself, or a folder
 * it's in (renamed or removed). Compared composed, as a watcher may report
 * a name in the other Unicode form.
 */
export function touches(path: string, changed: Iterable<string>): boolean {
  const note = path.normalize('NFC');
  for (const changedPath of changed) {
    const at = changedPath.normalize('NFC');
    if (isInside(note, at)) return true;
  }
  return false;
}
