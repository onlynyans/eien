// The phone's other note: the page remembers the note it left and where, the
// back bar's slip offers it, and a tap goes back to it in place.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { noted, pagesWith } from './pages-harness';
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
    const { note, page } = noted(pages.active);
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

  it('keeps how far it was scrolled, though the page is out of sight when the next opens', async () => {
    // On a phone, back to the list hides the page first, and a page out of sight reads 0.
    const { pages } = await twoNotes();
    const { note, page } = noted(pages.active);
    await pages.open('Chapter.md');
    const top = vi.spyOn(page.scroll, 'scrollTop', 'get').mockReturnValue(900);
    page.scroll.dispatchEvent(new Event('scroll'));
    top.mockReturnValue(0); // gone from sight
    await pages.open('Notes.md');
    expect(note.left).toMatchObject({ scroll: 900 });
  });

  it('isn’t the note reopened on its own page', async () => {
    const { pages } = await twoNotes();
    await pages.open('Chapter.md');
    await pages.open('Chapter.md');
    expect(pages.active.left).toBeNull();
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
    expect(other.element.getAttribute('aria-label')).toBe('Switch to Chapter');
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

describe('the other note, with two pages', () => {
  it('is the facing page while there is one, and stays it, where it was, once that closes', async () => {
    const made = await pagesWith({
      'Chapter.md': 'The gate held. It held all night.',
      'Notes.md': 'Erwin.',
      'Map.md': 'The wall, the gate, the stair.',
    });
    stops.push(() => made.pages.stop());
    const { pages } = made;
    const open = vi.fn(async () => {});
    const other = phoneOther({ pages, has: () => true, onPage: () => true, open });
    await pages.open('Map.md');
    await pages.open('Chapter.md'); // Map is the note this page left
    other.sync();
    await pages.open('Notes.md', true); // Notes on a facing page, the one you're in
    const facing = pages.other && noted(pages.other); // Chapter's page
    if (!facing) throw new Error('no facing page');
    facing.page.editor.view.dispatch({ selection: { anchor: 4, head: 8 } });
    other.sync();
    // Folded: the facing page closes, and its note is the other one, not the older Map.
    pages.close(facing);
    other.sync();
    expect(other.element.hidden).toBe(false);
    other.element.click();
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'Chapter.md', anchor: 4, head: 8 }),
    );
  });

  it('is the facing page still, though the page you’re in opened another meanwhile', async () => {
    const made = await pagesWith({
      'Chapter.md': 'The gate held.',
      'Notes.md': 'Erwin.',
      'Map.md': 'The wall.',
    });
    stops.push(() => made.pages.stop());
    const { pages } = made;
    const open = vi.fn(async () => {});
    const other = phoneOther({ pages, has: () => true, onPage: () => true, open });
    await pages.open('Chapter.md');
    await pages.open('Notes.md', true); // Notes facing Chapter, the one you're in
    other.sync();
    await pages.open('Map.md'); // the page you're in leaves Notes for Map
    other.sync();
    const facing = pages.other; // Chapter's
    if (!facing) throw new Error('no facing page');
    pages.close(facing); // folded
    other.sync();
    other.element.click();
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ path: 'Chapter.md' }));
  });
});
