// With two panes the sidebar's tree lists the notes: under the vault, each
// open folder, All Notes, Pinned and each open tag. Each is the list the
// note list would show there, in the same sort.

import type { NumeralStyle } from '../../core/text';
import { listKey, sortFor } from '../list/sorts';
import { selectionOf } from '../sidebar/tree';
import { findFolder, type NoteList, type VaultState } from './vault-state';

/** The notes under the vault ("") and every open row, by openId. */
export async function treeNotes(
  state: VaultState,
  open: ReadonlySet<string>,
  numerals: NumeralStyle,
): Promise<Map<string, NoteList>> {
  const ids = ['', ...[...open].filter((id) => id !== '')];
  const lists = await Promise.all(
    ids.map(async (id): Promise<[string, NoteList] | null> => {
      const selection = selectionOf(id);
      // An open folder that's gone (renamed or trashed elsewhere) lists nothing.
      if (!selection || (selection.kind === 'folder' && !findFolder(state.tree, selection.path))) {
        return null;
      }
      return [id, await state.notesFor(selection, numerals, sortFor(listKey(selection)))];
    }),
  );
  return new Map(lists.filter((entry) => entry !== null));
}
