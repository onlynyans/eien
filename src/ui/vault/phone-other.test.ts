// The phone's other note: the page remembers the note it left and where, the
// back bar's slip offers it, and a tap goes back to it in place.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { pagesWith } from './pages-harness';
import { phoneOther } from './phone-other';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

async function twoNotes() {
  const made = await pagesWith({
    'Chapter.md': 'The gate held. It held all night.',
    'Notes.md': 'Erwin.',
  });
  stops.push(() => made.pages.stop());
  return made;
}

describe('a page’s last note', () => {
  it('is remembered where it was left, and opened there again', async () => {
    const { pages } = await twoNotes();
    const { note, page } = pages.active;
    await pages.open('Chapter.md');
    page.editor.view.dispatch({ selection: { anchor: 9, head: 14 } });
    await pages.open('Notes.md');
    expect(note.left).toMatchObject({ path: 'Chapter.md', anchor: 9, head: 14 });
    const place = note.left;
    if (!place) throw new Error('nothing left');
    await pages.open('Chapter.md', false, place);
    expect(page.editor.view.state.selection.main).toMatchObject({ anchor: 9, head: 14 });
    expect(note.left?.path).toBe('Notes.md');
  });

  it('isn’t the note reopened on its own page', async () => {
    const { pages } = await twoNotes();
    await pages.open('Chapter.md');
    await pages.open('Chapter.md');
    expect(pages.active.note.left).toBeNull();
  });
});

describe('the back bar’s other note', () => {
  it('shows the note you came from, with the page in sight, and goes back to it', async () => {
    const { pages } = await twoNotes();
    let onPage = true;
    const exists = new Set(['Chapter.md', 'Notes.md']);
    const open = vi.fn(async () => {});
    const other = phoneOther({
      pages,
      has: (path) => exists.has(path),
      onPage: () => onPage,
      open,
    });
    await pages.open('Chapter.md');
    other.sync();
    expect(other.element.hidden).toBe(true); // nothing to go back to yet
    await pages.open('Notes.md');
    other.sync();
    expect(other.element.hidden).toBe(false);
    expect(other.element.getAttribute('aria-label')).toBe('Switch to the other note: Chapter');
    other.element.click();
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ path: 'Chapter.md' }));
    onPage = false;
    other.sync();
    expect(other.element.hidden).toBe(true);
    onPage = true;
    exists.delete('Chapter.md'); // gone from the vault meanwhile
    other.sync();
    expect(other.element.hidden).toBe(true);
  });
});
