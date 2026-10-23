// The window's name is its note's (or, with none, its vault's): the system lists
// windows by it (macOS's Window menu, the taskbar), so with several open each
// is found by what it shows.

import { baseName, titleOf } from '../../core/paths';

/** Name the window for the note at `path`, or the vault `vault` when there's none. */
export function nameWindow(path: string | null, vault: string): void {
  const name = path ? titleOf(baseName(path)) : vault;
  if (document.title !== name) document.title = name;
}
