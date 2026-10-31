// A book's Found (#40, Phase 5c), the list's field searching the book its
// contents show, over a real page: the lens following the words, the search
// synced before the panes draw (asked once per book and words, stopped with
// no rows in sight), reading it changing nothing, Enter going to the next
// match past the place (or waiting for the search to look there, on that
// book alone), and the result said once in the colophon.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { BookTexts } from '../epub/book-search';
import type { EpubSide } from '../epub/epub-side-types';
import { laidOut } from '../epub/test-lines';
import { sideWith } from '../epub/test-side';
import { epubFound } from './epub-found';
import { Navigation } from './navigation';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);
const opens: EpubSide[] = [];

afterEach(() => {
  for (const side of opens.splice(0)) side.dispose();
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

async function opened() {
  const at = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
  laidOut(at.side.page);
  opens.push(at.side);
  await at.side.open('a.epub');
  const nav = new Navigation();
  const redraw = vi.fn();
  const found = epubFound({ texts: new BookTexts(), nav, still: (then) => then(), redraw });
  const epub = at.side.epub;
  if (!epub) throw new Error('no book');
  return { ...at, nav, redraw, found, epub };
}

const said = (side: EpubSide) => side.page.foot.said.textContent;

describe('a book’s Found', () => {
  it('turns the list to Found with two letters, and back to Contents once they’re gone', async () => {
    const { nav, found } = await opened();
    found.typed('B');
    expect(nav.bookLens).toBe('contents');
    found.typed('Be');
    expect(nav.bookLens).toBe('found');
    found.typed('');
    expect(nav.bookLens).toBe('contents');
    nav.bookLens = 'marks';
    found.typed('');
    expect(nav.bookLens).toBe('marks');
  });

  it('searches once for a book and its words however often the panes sync, and reading it changes nothing', async () => {
    const { side, found, epub, redraw } = await opened();
    const read = vi.spyOn(epub, 'chapter');
    found.sync(side, 'B');
    expect(found.model(side, epub)).toBeNull();
    found.sync(side, 'Bennet');
    await vi.waitFor(() => expect(found.model(side, epub)?.done).toBe(true));
    const reads = read.mock.calls.length;
    found.sync(side, 'Bennet');
    found.model(side, epub);
    expect(read.mock.calls.length).toBe(reads);
    const model = found.model(side, epub);
    expect(model?.rows.length).toBeGreaterThan(SAMPLE_SOURCES.chapters.length);
    const places = (model?.rows ?? []).map((row) => row.spine * 1e6 + row.from);
    expect(places).toEqual([...places].sort((a, b) => a - b));
    expect(model?.rows[0]?.chapter).toMatch(/Chapter/u);
    expect(redraw).toHaveBeenCalled();
  });

  it('stops once no rows are in sight, its rows gone with it', async () => {
    const { side, found, epub } = await opened();
    found.sync(side, 'Bennet');
    found.sync(null, null);
    expect(found.model(side, epub)).toBeNull();
  });

  it('says the result once, in the book’s colophon, as the list’s line is never announced', async () => {
    const { side, found, epub } = await opened();
    found.sync(side, 'zebra crossing');
    await vi.waitFor(() => expect(found.model(side, epub)?.done).toBe(true));
    expect(said(side)).toBe('No “zebra crossing” in this book.');
    found.sync(side, 'Bennet');
    await vi.waitFor(() => expect(said(side)).toMatch(/^\d+ matches for “Bennet”\.$/u));
  });

  it('goes on Enter to the next match past the place, painted, the keyboard left in the field', async () => {
    const { side, found, epub } = await opened();
    found.sync(side, 'Bennet');
    await vi.waitFor(() => expect(found.model(side, epub)?.done).toBe(true));
    const total = found.model(side, epub)?.rows.length ?? 0;
    const field = document.body.appendChild(document.createElement('input'));
    field.focus();
    expect(found.step(side, 1)).toBe(true);
    await vi.waitFor(() => expect(said(side)).toBe(`Match 1 of ${total}.`));
    expect(document.activeElement).toBe(field);
    expect(document.getSelection()?.isCollapsed ?? true).toBe(true);
    expect(found.step(side, 1)).toBe(true);
    await vi.waitFor(() => expect(said(side)).toBe(`Match 2 of ${total}.`));
  });

  it('takes an Enter pressed before the search looked there, once it has', async () => {
    const { side, found } = await opened();
    found.typed('Bennet');
    found.sync(side, 'Bennet');
    expect(found.step(side, 1)).toBe(true);
    await vi.waitFor(() => expect(said(side)).toMatch(/^Match 1 of \d+\.$/u));
  });

  // The review (Phase 5c): an Enter with too few letters is never acted on later.
  it('takes no Enter with nothing searched, so none waits for words typed after', async () => {
    const { side, found, epub } = await opened();
    found.sync(side, 'N');
    expect(found.step(side, 1)).toBe(false);
    found.typed('Netherfield');
    found.sync(side, 'Netherfield');
    await vi.waitFor(() => expect(found.model(side, epub)?.done).toBe(true));
    expect(said(side)).not.toMatch(/^Match/u);
  });

  it('never walks the last words’ matches once others are typed', async () => {
    const { side, found, epub } = await opened();
    found.sync(side, 'Netherfield');
    await vi.waitFor(() => expect(found.model(side, epub)?.done).toBe(true));
    found.typed('Bennet');
    expect(found.model(side, epub)).toBeNull();
    expect(found.step(side, 1)).toBe(false);
  });
});
