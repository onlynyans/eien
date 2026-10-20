// The note a seal is for: the open one, through its page and session, and
// only while it stays the one on the page. A seal's changes to it (the id it
// adds, a restore) are one quiet edit, never a new text: the caret and the
// undo history stay, words typed meanwhile stay, and nothing is changed
// while the note is held still for a move.

import type { PageView } from '../page/page';
import type { OpenNote } from '../vault/open-note';
import type { SealTarget } from './note-versions';

export function sealTargetOf(note: OpenNote, page: PageView): SealTarget | null {
  const session = note.session;
  if (!session) return null;
  const editor = page.editor;
  const open = () => note.session === session;
  const save = async () => {
    if (!open()) return false;
    await session.flush();
    return open() && session.state !== 'failed';
  };
  return {
    get path() {
      return session.path; // a rename meanwhile carries the session along
    },
    open,
    text: () => session.text,
    amend: async (change, undoable) => {
      if (!open()) return false;
      const next = change(editor.text);
      // The editor refuses while it's held still (the note is being moved).
      if (next === null || !editor.amend(next, undoable)) return false;
      return save();
    },
    save,
  };
}
