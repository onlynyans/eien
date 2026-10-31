// A book's Found (#40, Phase 5c), the list's field searching the book its
// contents show, over a real page: the lens following the words, the search
// asked for once per book and words however often the list draws, Enter
// going to the next match past the place (or waiting for the first), and
// fewer than two letters searching nothing.

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
  document.body.replaceChildren();
});

async function opened() {
  const at = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
  laidOut(at.side.page);
  opens.push(at.side);
  await at.side.open('a.epub');
  const nav = new Navigation();
  const redraw = vi.fn();
  const found = epubFound({ texts: new BookTexts(), nav, redraw });
  const epub = at.side.epub;
  if (!epub) throw new Error('no book');
  return { ...at, nav, redraw, found, epub };
}

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

  it('searches the book once for its words however often the list draws, its rows in the book’s order', async () => {
    const { side, found, epub, redraw } = await opened();
    const read = vi.spyOn(epub, 'chapter');
    expect(found.model(side, epub, 'B')).toBeNull();
    found.model(side, epub, 'Bennet');
    await vi.waitFor(() => expect(found.model(side, epub, 'Bennet')?.done).toBe(true));
    const model = found.model(side, epub, 'Bennet');
    const reads = read.mock.calls.length;
    found.model(side, epub, 'Bennet');
    expect(read.mock.calls.length).toBe(reads);
    expect(model?.rows.length).toBeGreaterThan(1);
    const places = (model?.rows ?? []).map((row) => row.spine * 1e6 + row.from);
    expect(places).toEqual([...places].sort((a, b) => a - b));
    expect(model?.rows[0]?.chapter).toMatch(/Chapter/u);
    expect(redraw).toHaveBeenCalled();
  });

  it('goes on Enter to the next match past the place, chosen on the page, said in the colophon', async () => {
    const { side, found, epub } = await opened();
    found.model(side, epub, 'Netherfield');
    await vi.waitFor(() => expect(found.model(side, epub, 'Netherfield')?.done).toBe(true));
    const total = found.model(side, epub, 'Netherfield')?.rows.length ?? 0;
    expect(found.step(side, 1)).toBe(true);
    await vi.waitFor(() => expect(document.getSelection()?.toString()).toBe('Netherfield'));
    expect(side.page.foot.said.textContent).toBe(`Match 1 of ${total}.`);
  });

  it('takes an Enter pressed before the words’ first match, once it’s found', async () => {
    const { side, found, epub } = await opened();
    found.typed('Netherfield');
    expect(found.step(side, 1)).toBe(true);
    found.model(side, epub, 'Netherfield');
    await vi.waitFor(() => expect(side.page.foot.said.textContent).toMatch(/^Match 1 of \d+\.$/u));
  });

  it('never walks the last words’ matches once others are typed', async () => {
    const { side, found, epub } = await opened();
    found.model(side, epub, 'Netherfield');
    await vi.waitFor(() => expect(found.model(side, epub, 'Netherfield')?.done).toBe(true));
    found.typed('Bennet');
    expect(found.model(side, epub, 'zzz-none')?.rows).toEqual([]);
    expect(found.step(side, 1)).toBe(true);
    await vi.waitFor(() => expect(found.model(side, epub, 'zzz-none')?.done).toBe(true));
    expect(found.step(side, 1)).toBe(false);
  });
});
