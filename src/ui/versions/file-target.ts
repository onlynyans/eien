// A note as its file holds it, for a Restore that has to go on once another
// note is on the page: the restore finishes in the note's own file, never on
// the page. Each change is read, made and written in one go, and only over
// the file as read, so words written there meanwhile are never written over.

import { formatOf, fromEditor, toEditor } from '../../core/text';
import type { VaultBridge } from '../../platform/bridge';
import type { SealTarget } from './note-versions';

/** The note at `path` as its file holds it now; null when there's no file there. */
export async function fileTarget(
  vault: Pick<VaultBridge, 'read' | 'write'>,
  path: string,
): Promise<SealTarget | null> {
  let text = '';
  const reread = async () => {
    const file = await vault.read(path);
    if (file) text = toEditor(file.text);
    return file;
  };
  if (!(await reread())) return null;
  return {
    path,
    open: () => true, // the file stays its own note
    text: () => text,
    amend: async (change) => {
      const file = await reread();
      const next = file ? change(text) : null;
      if (!file || next === null) return false;
      const written = await vault.write(path, fromEditor(next, formatOf(file.text)), file.version);
      if (written.ok) text = next;
      return written.ok;
    },
    // Nothing is unsaved in a file: saving is reading what it holds now.
    save: async () => (await reread()) !== null,
  };
}
