// The pages of a shown vault, with one page: the note it shows, the pane's
// colophon in its order, and what the organizer and the window ask of it.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { pagesWith, typeAtEnd } from './pages-harness';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

describe('the pages, with one page', () => {
  it('make their page without telling the window anything, as the window is made after them', async () => {
    // The vault view makes the pages before the chrome they'd tell: a call back now would reach
    // a chrome not yet made, and the vault would never show.
    const { pages, told } = await pagesWith({ 'Snow.md': 'Snow.' });
    stops.push(() => pages.stop());
    expect(told()).toBe(0);
  });

  it('shows the note opened on the active page, and names it as the only note shown', async () => {
    const { pages, area } = await pagesWith({ 'Fic/Snow.md': 'Snow fell all night.' });
    stops.push(() => pages.stop());
    expect(pages.notes()).toEqual({ active: null, other: null });
    await pages.open('Fic/Snow.md');
    expect(pages.notes()).toEqual({ active: 'Fic/Snow.md', other: null });
    expect(pages.sides).toHaveLength(1);
    expect(pages.active.page.element.hasAttribute('data-active')).toBe(true); // the one page
    expect(pages.active.page.editor.text).toBe('Snow fell all night.');
    // The window's running head, which the layout puts across the window (../chrome).
    expect(pages.pane.head.querySelector('.running-crumbs')?.textContent).toBe('Fic');
    expect(area.querySelector('.colophon .colophon__words')?.textContent).toBe('4 words');
  });

  it('lays the colophon out as one page always had it: its words and save, the counters, its seal', async () => {
    const { pages, area } = await pagesWith({});
    stops.push(() => pages.stop());
    const parts = [...(area.querySelector('.colophon')?.children ?? [])].map((part) =>
      part.className.replace(/^colophon__/, ''),
    );
    expect(parts).toEqual(['tags', 'words', 'state', 'counters', 'seal', 'zoom', 'news', 'said']);
    // Beside the pane's parts, what floats over the page: its selection bar, kept.
    expect(area.querySelectorAll('.selection-bar')).toHaveLength(1);
  });

  it('shows the pane’s zoom as the setting changes', async () => {
    const { pages, area, change } = await pagesWith({}, { 'page.zoom': 120 });
    stops.push(() => pages.stop());
    const zoom = () => area.querySelector('.colophon__zoom')?.textContent;
    expect(zoom()).toBe('120%');
    change({ 'page.zoom': 100 });
    expect(zoom()).toBe('');
  });

  it('saves the words typed on a page when the window asks, and counts them once', async () => {
    const { pages, storage, wrote } = await pagesWith({ 'Snow.md': 'Snow.' });
    stops.push(() => pages.stop());
    await pages.open('Snow.md');
    typeAtEnd(pages, ' The gate held.');
    await pages.flush();
    expect((await storage.read('Snow.md'))?.text).toBe('Snow. The gate held.');
    expect(wrote()).toEqual([3]);
  });

  it('shows a note afresh when it’s opened again on its page, as when another is', async () => {
    // Compare and the cards start afresh with each showing (../versions/versions-ui.ts, sync).
    const { pages } = await pagesWith({ 'Snow.md': 'Snow.', 'Rain.md': 'Rain.' });
    stops.push(() => pages.stop());
    const { note } = pages.active;
    await pages.open('Snow.md');
    const first = note.shown;
    const session = note.session;
    await pages.open('Snow.md');
    expect(note.shown).toBe(first + 1);
    expect(note.session).toBe(session); // the one session: nothing read twice, nothing to save twice
    await pages.open('Rain.md');
    expect(note.shown).toBe(first + 2);
    expect(pages.sessions().map(({ path }) => path)).toEqual(['Rain.md']);
  });

  it('closes the page whose note went to the trash with its folder, and no other', async () => {
    const { pages } = await pagesWith({ 'Fic/Snow.md': 'Snow.', 'Rain.md': 'Rain.' });
    stops.push(() => pages.stop());
    await pages.open('Fic/Snow.md');
    pages.closed('Rain.md');
    expect(pages.notes().active).toBe('Fic/Snow.md');
    pages.closed('Fic');
    expect(pages.notes().active).toBeNull();
    expect(pages.sessions()).toEqual([]);
    expect(pages.active.page.writable).toBe(false);
  });

  it('holds still the page whose note is moving, and lets it go after', async () => {
    const { pages } = await pagesWith({ 'Fic/Snow.md': 'Snow.' });
    stops.push(() => pages.stop());
    await pages.open('Fic/Snow.md');
    const { editor } = pages.active.page;
    pages.freeze('Other', true);
    expect(editor.amend('Snow, still.', false)).toBe(true);
    pages.freeze('Fic', true);
    expect(editor.amend('Snow, held.', false)).toBe(false);
    pages.freeze('Fic', false);
    expect(editor.amend('Snow, let go.', false)).toBe(true);
  });

  it('changes an open note’s words as Eien’s own, through its page, and saves them', async () => {
    const { pages, storage } = await pagesWith({ 'Snow.md': 'Snow.' });
    stops.push(() => pages.stop());
    expect(await pages.amendOpen('Snow.md', (text) => `${text} Amended.`)).toBeNull();
    await pages.open('Snow.md');
    expect(await pages.amendOpen('Snow.md', (text) => `${text} Amended.`)).toBe(true);
    expect((await storage.read('Snow.md'))?.text).toBe('Snow. Amended.');
    expect(pages.active.page.editor.text).toBe('Snow. Amended.');
  });

  it('tells the caret’s moves on the active page to those listening, until they stop', async () => {
    const { pages } = await pagesWith({ 'Snow.md': 'Snow.' });
    stops.push(() => pages.stop());
    await pages.open('Snow.md');
    const heard = vi.fn();
    const stop = pages.onCaret(heard);
    pages.active.page.editor.view.dispatch({ selection: { anchor: 2 } });
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    pages.active.page.editor.view.dispatch({ selection: { anchor: 3 } });
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
