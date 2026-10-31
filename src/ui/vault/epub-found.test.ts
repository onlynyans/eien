// A book's Found (#40, Phase 5c), the list's field searching the book its
// contents show, over a real page: the lens following the words, the search
// synced before the panes draw (asked once per book and words, stopped with
// no rows in sight), reading it changing nothing, Enter going to the next
// match past the place (or waiting for the search to look there, on that
// book alone), and the result said once in the colophon.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import type { Epub } from '../../core/epub';
import { BookTexts } from '../epub/book-search';
import type { EpubSide } from '../epub/epub-side-types';
import { laidOut } from '../epub/test-lines';
import { sideWith } from '../epub/test-side';
import { type EpubFound, epubFound } from './epub-found';
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

/** The search synced for `words` on `side`'s book, as the panes do before they draw, then what it found read. */
function look(found: EpubFound, side: EpubSide, epub: Epub, words: string) {
  found.sync(side, words);
  return found.model(side, epub);
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

describe('a book’s Found, as QA tried it (Phase 5c)', () => {
  it('goes back on ⇧Enter from the place, round to the book’s last match', async () => {
    const { side, found, epub } = await opened();
    found.sync(side, 'Bennet');
    await vi.waitFor(() => expect(look(found, side, epub, 'Bennet')?.done).toBe(true));
    const total = look(found, side, epub, 'Bennet')?.rows.length ?? 0;
    // The place is chapter I's top: none before it, so round to the last.
    expect(found.step(side, -1)).toBe(true);
    await vi.waitFor(() =>
      expect(side.page.foot.said.textContent).toBe(`Match ${total} of ${total}.`),
    );
  });

  it('searches the words as written, a pattern’s characters as themselves, the same words trimmed once', async () => {
    const { side, found, epub } = await opened();
    found.sync(side, 'Mr.');
    await vi.waitFor(() => expect(look(found, side, epub, 'Mr.')?.done).toBe(true));
    const rows = look(found, side, epub, 'Mr.')?.rows ?? [];
    expect(rows.length).toBeGreaterThan(0);
    // Never "Mrs": the full stop is a full stop.
    expect(new Set(rows.map((row) => row.words))).toEqual(new Set(['Mr.']));
    // The same words with spaces round them: no search started again.
    expect(look(found, side, epub, '  Mr.  ')?.done).toBe(true);
    expect(look(found, side, epub, '((')?.rows).toEqual([]);
    await vi.waitFor(() => expect(look(found, side, epub, '((')?.done).toBe(true));
    expect(look(found, side, epub, '((')?.rows).toEqual([]);
  });

  it('searches again for the same words in another book', async () => {
    const { side, found, epub } = await opened();
    found.sync(side, 'Bennet');
    await vi.waitFor(() => expect(look(found, side, epub, 'Bennet')?.done).toBe(true));
    const other = { ...epub, key: 'another' };
    expect(look(found, { ...side, epub: other } as EpubSide, other, 'Bennet')?.done).toBe(false);
  });

  it('turns no lens for blank words', async () => {
    const { nav, found } = await opened();
    found.typed('   ');
    expect(nav.bookLens).toBe('contents');
    found.typed(' B ');
    expect(nav.bookLens).toBe('contents');
  });

  // QA (Phase 5c) found an Enter with fewer than two letters in the field kept as waiting, and
  // taken once words were typed: the page moved as the reader typed. Fixed: none is taken then.
  it('forgets an Enter pressed while nothing is searched, once words are typed (fixed)', async () => {
    const { side, found, epub } = await opened();
    document.getSelection()?.removeAllRanges();
    found.typed('');
    expect(look(found, side, epub, '')).toBeNull();
    found.step(side, 1);
    found.typed('Netherfield');
    await vi.waitFor(() => expect(look(found, side, epub, 'Netherfield')?.done).toBe(true));
    await new Promise((done) => setTimeout(done, 50));
    expect(side.page.foot.said.textContent).not.toMatch(/^Match/u);
    expect(document.getSelection()?.toString()).toBe('');
  });
});
