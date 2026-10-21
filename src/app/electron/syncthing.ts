// Whether Syncthing syncs a vault (the sidebar's sync status, backlog #10):
// Syncthing marks each folder it syncs with a `.stfolder` folder (a file, in
// older versions) at its top.

import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Whether Syncthing syncs the folder at `root`: its `.stfolder` marker is in
 * the folder, or in a folder it's in (a vault inside a synced Documents).
 */
export async function syncedBySyncthing(root: string): Promise<boolean> {
  for (let at = root; ; at = dirname(at)) {
    if (await stat(join(at, '.stfolder')).then(() => true, () => false)) return true;
    if (dirname(at) === at) return false;
  }
}
