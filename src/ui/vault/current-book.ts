// The book the writer means (spec §4, §8): the one the open note is a
// chapter of, else the folder chosen in the sidebar when it's a book. Outline
// Cards shows it; Export Book exports it.

import { parentOf } from '../../core/paths';
import type { Navigation } from './navigation';
import type { VaultState } from './vault-state';

/** Whether `folder` is a book. */
export const isBook = async (state: VaultState, folder: string): Promise<boolean> =>
  (await state.folderSettings(folder)).book !== null;

/** The book's folder, or null when neither the open note nor the folder chosen is in one. */
export async function currentBook(
  state: VaultState,
  nav: Navigation,
  openPath: string | null,
): Promise<string | null> {
  if (openPath && (await isBook(state, parentOf(openPath)))) return parentOf(openPath);
  const chosen = nav.selection;
  return chosen.kind === 'folder' && (await isBook(state, chosen.path)) ? chosen.path : null;
}
