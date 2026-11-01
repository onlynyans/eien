import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { handEpub, nav, opf, XHTML, page as xhtml } from '../../../tests/support/epub-parts';
import type { Epub } from '../../core/epub';
import { BookCount } from './book-count';
import { epubKind } from './epub-kind';
import { EpubPage } from './epub-page';
import { makeEpubSide } from './epub-side';
import { type EpubSide, isEpub } from './epub-side-types';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);

const chapterText = (side: EpubSide) => side.page.chapter.textContent ?? '';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('a book counted for its page numbers (Phase 4a)', () => {
  /** Each count a page asked for, and the spy on how it stopped. */
  function counting() {
    const run = BookCount.prototype.run;
    const stops: Mock[] = [];
    vi.spyOn(BookCount.prototype, 'run').mockImplementation(function (this: BookCount, ...args) {
      const stop = vi.fn(run.apply(this, args));
      stops.push(stop);
      return stop;
    });
    return stops;
  }

  it('tells the window each chapter counted, never redrawing the panes: Marks rows have their places then (Phase 4c, #67)', async () => {
    const { side, changed, of } = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
    await side.open('a.epub');
    changed.mockClear();
    await vi.waitFor(() => expect(of.counted).toHaveBeenCalledWith('a.epub', expect.any(Number)));
    const count = of.counts.of(side.epub as Epub);
    await vi.waitFor(() => expect(count.whole).toBe(true));
    // Each chapter in the background told, the chapter drawn counted as it was drawn.
    expect(vi.mocked(of.counted).mock.calls.length).toBe((side.epub?.spine.length ?? 0) - 1);
    expect(side.labelAt(1, 0)).not.toBeNull();
    expect(changed).not.toHaveBeenCalled();
  });

  it('counts once the chapter is drawn, and stops for another book, a cleared page or one gone', async () => {
    const stops = counting();
    const { side } = sideWith({
      'a.epub': EPUBS['plain.epub'] as Uint8Array,
      'b.epub': EPUBS['page-list.epub'] as Uint8Array,
    });
    await side.open('a.epub');
    expect(stops).toHaveLength(1);
    await side.open('b.epub');
    expect(stops[0]).toHaveBeenCalledOnce();
    side.clear();
    expect(stops[1]).toHaveBeenCalledOnce();
    await side.open('a.epub');
    side.dispose();
    expect(stops[2]).toHaveBeenCalledOnce();
  });

  // QA (#40, Phase 4a): the count asked for only by the book that stays on the page.
  it('never counts a book another replaced while it opened, and starts again when its file changes', async () => {
    const stops = counting();
    const run = vi.mocked(BookCount.prototype.run);
    const { side } = sideWith({
      'a.epub': EPUBS['plain.epub'] as Uint8Array,
      'b.epub': EPUBS['page-list.epub'] as Uint8Array,
    });
    // Another book asked for as the first one's chapter is drawn: past the checks before the draw.
    const drawn = EpubPage.prototype.drawn;
    let second: Promise<void> = Promise.resolve();
    vi.spyOn(EpubPage.prototype, 'drawn').mockImplementationOnce(function (
      this: EpubPage,
      ...args
    ) {
      drawn.apply(this, args);
      second = side.open('b.epub');
    });
    await side.open('a.epub');
    await second;
    expect(stops).toHaveLength(1);
    expect(run.mock.calls[0]?.[0]).toBe(side.epub);
    // Read again (its file changed on disk): the last count stopped, a new one asked for.
    await side.reload();
    expect(stops[0]).toHaveBeenCalledOnce();
    expect(stops).toHaveLength(2);
  });
});

describe('a book’s page', () => {
  it('opens the book at its first chapter, named by its title, its head the title and author (#57)', async () => {
    const { side, changed } = sideWith({
      'Novels/P and P.epub': EPUBS['plain.epub'] as Uint8Array,
    });
    await side.open('Novels/P and P.epub');
    expect(side.page.name).toBe('Pride and Prejudice');
    // The book, not the folder it's in, as its row on SHELF names it; the folders on its title page.
    // This one says no author: its title alone.
    expect(side.page.element.querySelector('.crumbs')?.textContent).toBe('Pride and Prejudice');
    expect(side.page.runningCrumbs.textContent).toBe('Pride and Prejudice');
    const { side: by } = sideWith({ 'Novels/P.epub': EPUBS['epub2.epub'] as Uint8Array });
    await by.open('Novels/P.epub');
    expect(by.page.element.querySelector('.crumbs')?.textContent).toBe(
      'Pride and Prejudice · Jane Austen',
    );
    expect(by.page.runningCrumbs.textContent).toBe('Pride and Prejudice · Jane Austen');
    expect(chapterText(side)).toContain('It is a truth universally acknowledged');
    expect(side.page.chapter.lang).toBe('en');
    expect(side.spine).toBe(1); // the title page before it isn't in the contents
    expect(side.page.foot.figures[1]?.textContent).toBe('2 of 4');
    expect(side.place).toEqual({
      path: 'Novels/P and P.epub',
      name: 'Pride and Prejudice',
      spine: 1,
      offset: 0,
    });
    expect(changed).toHaveBeenCalled();
  });

  it('draws a chapter’s pictures from the zip as the window’s own copies, let go with it', async () => {
    const made = vi.spyOn(URL, 'createObjectURL');
    const revoked = vi.spyOn(URL, 'revokeObjectURL');
    const { side } = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
    await side.open('a.epub');
    await side.go(3);
    const img = side.page.chapter.querySelector('img');
    expect(img?.getAttribute('src')).toMatch(/^blob:/u);
    expect(made).toHaveBeenCalledTimes(1);
    await side.go(1);
    expect(revoked).toHaveBeenCalledWith(img?.getAttribute('src'));
    await side.go(3);
    side.dispose();
    expect(revoked).toHaveBeenCalledTimes(2);
    expect(side.page.element.isConnected).toBe(false);
  });

  it('keeps the chapter moved to, and opens there next time', async () => {
    const files = { 'a.epub': EPUBS['plain.epub'] as Uint8Array };
    const first = sideWith(files);
    await first.side.open('a.epub');
    await first.side.go(3);
    expect([...first.kept.values()]).toEqual([{ chapter: 'OEBPS/chapter-3.xhtml', offset: 0 }]);
    const again = makeEpubSide(first.of, { close: () => {}, caret: () => {} }, null);
    await again.open('a.epub');
    expect(again.spine).toBe(3);
    expect(chapterText(again)).toContain('Not all that Mrs. Bennet');
  });

  it('moves to another chapter of the book open without reading the file again', async () => {
    const { side, reads } = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
    await side.open('a.epub');
    await side.open('a.epub', { path: 'a.epub', name: 'x', spine: 2 } as never);
    expect(side.spine).toBe(2);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('says why a book won’t open, and draws nothing of it', async () => {
    const { side } = sideWith({ 'drm.epub': EPUBS['drm.epub'] as Uint8Array }, [
      'drm.epub',
      'huge.epub',
    ]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await side.open('drm.epub');
    const notice = side.page.element.querySelector('.notice');
    expect(notice?.textContent).toMatch(/locked with DRM/u);
    expect(side.epub).toBeNull();
    expect(chapterText(side)).toBe('');
    // Listed but not read: past what the storage reads in one piece.
    await side.open('huge.epub');
    expect(notice?.textContent).toMatch(/too large/u);
    await side.open('gone.epub');
    expect(notice?.textContent).toMatch(/isn’t there/u);
  });

  it('never draws a slower book over a newer one', async () => {
    const files = {
      'a.epub': EPUBS['plain.epub'] as Uint8Array,
      'b.epub': EPUBS['plates.epub'] as Uint8Array,
    };
    const { side } = sideWith(files);
    const slow = side.open('a.epub');
    await side.open('b.epub');
    await slow;
    expect(side.path).toBe('b.epub');
    expect(side.page.chapter.querySelector('[data-part="plate"]')).not.toBeNull();
    // What it was asked to show before is where ⇄ goes back to.
    expect(side.left?.path).toBe('a.epub');
  });

  it('shows nothing once cleared, and its × closes it', async () => {
    const { side, close } = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
    await side.open('a.epub');
    side.clear();
    expect(side.path).toBeNull();
    expect(side.page.name).toBe(''); // the window takes its vault's name
    expect(side.page.unnamed).toBe('No book'); // the pager's, a folded split's edge
    expect(side.page.element.querySelector<HTMLElement>('.page__empty')?.hidden).toBe(false);
    side.page.tipped[0]?.click();
    expect(close).toHaveBeenCalled();
  });
});

describe('the EPUB’s kind', () => {
  it('holds .epub files alone', () => {
    const kind = epubKind(sideWith({}).of);
    expect(kind.holds('Novels/Emma.EPUB')).toBe(true);
    expect(kind.holds('Novels/Emma.md')).toBe(false);
    expect(kind.holds('Novels/.Emma.epub')).toBe(false);
  });

  it('follows a folder this window moved, and lets a book gone from the vault go', async () => {
    const { side, of } = sideWith({ 'Novels/a.epub': EPUBS['plain.epub'] as Uint8Array });
    const kind = epubKind(of);
    await side.open('Novels/a.epub');
    await side.go(0); // Eien's title page, which names the folders, before it
    kind.moved('Novels', 'Books/Novels');
    kind.followMoves([side]);
    expect(side.path).toBe('Books/Novels/a.epub');
    // Its head is the book's, wherever it's moved; its title page names the folders it's in now.
    expect(side.page.element.querySelector('.crumbs')?.textContent).toBe('Pride and Prejudice');
    expect(side.page.chapter.querySelector('.epub-front__shelf')?.textContent).toBe(
      'Books / Novels',
    );
    kind.sync([side]); // the vault lists the old path only: the book's gone
    expect(side.path).toBeNull();
  });

  it('keeps its own title, renamed; a book with none takes its file’s new name', async () => {
    const { side, of } = sideWith({ 'Novels/a.epub': EPUBS['plain.epub'] as Uint8Array });
    const kind = epubKind(of);
    await side.open('Novels/a.epub');
    kind.moved('Novels/a.epub', 'Novels/b.epub');
    kind.followMoves([side]);
    expect(side.page.name).toBe('Pride and Prejudice');
    // As a book whose package names no title is: called by its file, as SHELF calls it.
    Object.assign(side.epub as object, { title: '' });
    kind.moved('Novels/b.epub', 'Novels/First Impressions.epub');
    kind.followMoves([side]);
    expect(side.page.name).toBe('First Impressions');
  });

  it('names a renamed book with no title of its own by its new file in its head, its author kept (#57)', async () => {
    const { side, of } = sideWith({ 'Novels/a.epub': EPUBS['epub2.epub'] as Uint8Array });
    const kind = epubKind(of);
    await side.open('Novels/a.epub');
    Object.assign(side.epub as object, { title: '' });
    kind.moved('Novels/a.epub', 'Novels/First Impressions.epub');
    kind.followMoves([side]);
    // Its head and the running head alike, never the folder it's in.
    expect(side.page.element.querySelector('.crumbs')?.textContent).toBe(
      'First Impressions · Jane Austen',
    );
    expect(side.page.runningCrumbs.textContent).toBe('First Impressions · Jane Austen');
  });

  it('reads a book again when its file changes, and waits for its place to be kept', async () => {
    const files = { 'a.epub': EPUBS['plain.epub'] as Uint8Array };
    const { side, of, reads } = sideWith(files);
    const kind = epubKind(of);
    await side.open('a.epub');
    await side.go(2);
    kind.diskChanged(new Set(['a.epub']), [side]);
    await vi.waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(side.spine).toBe(2));
    await kind.flush([side]);
    expect(isEpub(side)).toBe(true);
    expect(isEpub({ ...side, kind: 'note' } as never)).toBe(false);
  });
});

describe('the review’s cases (#40, Phase 1b)', () => {
  it('opens a book refused once, then fixed, when its file changes', async () => {
    const files: Record<string, Uint8Array> = { 'a.epub': EPUBS['drm.epub'] as Uint8Array };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { side } = sideWith(files);
    await side.open('a.epub');
    expect(side.place).toMatchObject({ spine: -1 });
    files['a.epub'] = EPUBS['plain.epub'] as Uint8Array;
    await side.reload();
    expect(chapterText(side)).toContain('It is a truth universally acknowledged');
  });

  it('shows nothing of the last book while the next one opens', async () => {
    const { side } = sideWith({
      'a.epub': EPUBS['plain.epub'] as Uint8Array,
      'b.epub': EPUBS['plates.epub'] as Uint8Array,
    });
    await side.open('a.epub');
    const opening = side.open('b.epub');
    expect(chapterText(side)).toBe('');
    expect(side.page.foot.figures[1]?.textContent).toBe('');
    await opening;
  });

  it('keeps the chapter only when it changes', async () => {
    const { side, writes } = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
    await side.open('a.epub');
    expect(writes).not.toHaveBeenCalled(); // opened where it was: nothing to keep
    await side.go(2);
    await side.go(2);
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it('says a book that couldn’t be read isn’t too large unless it is', async () => {
    const { side, of } = sideWith({}, ['small.epub']);
    of.sizeOf = () => 10;
    await side.open('small.epub');
    expect(side.page.element.querySelector('.notice')?.textContent).toMatch(/couldn’t be read/u);
  });

  it('follows a move before asking whether its book is still there', async () => {
    const { side, of, listed } = sideWith({ 'Novels/a.epub': EPUBS['plain.epub'] as Uint8Array });
    const kind = epubKind(of);
    await side.open('Novels/a.epub');
    kind.moved('Novels', 'Books');
    listed.splice(0, listed.length, 'Books/a.epub'); // the vault read again, before the pages followed
    kind.sync([side]);
    expect(side.path).toBe('Books/a.epub');
  });
});

describe('a book’s own look (#40, Phase 1c)', () => {
  it('is worn on its page’s leaf, from the shelf’s settings, never the notes’', async () => {
    const { withDefaults } = await import('../../core/config');
    const { side } = sideWith({});
    side.follow(
      withDefaults({
        'appearance.face': 'hanken',
        'epub.appearance.face': 'literata',
        'epub.appearance.textSize': 110,
      }),
    );
    const leaf = side.page.element;
    expect(leaf.dataset.face).toBe('literata');
    expect(leaf.dataset.frame).toBe('sheet');
    expect(leaf.style.getPropertyValue('--eien-text-scale')).toBe('1.1');
    expect(document.documentElement.dataset.face).toBeUndefined();
  });
});

// QA (#40, Phase 3d): Eien's title page and imprint come before the book's
// first chapter in reading order (its first linear item) and no other; a
// cover the spine leaves out of the reading order has none before it.
describe('the front matter drawn with a book’s first chapter', () => {
  const front = (side: EpubSide) => side.page.chapter.querySelector('.epub-front');

  it('comes before the first item in reading order alone, shelved where the book is', async () => {
    const { side } = sideWith({ 'Novels/P and P.epub': EPUBS['plain.epub'] as Uint8Array });
    await side.open('Novels/P and P.epub');
    // Opened at Chapter I, the book's own title page before it.
    expect(side.spine).toBe(1);
    expect(front(side)).toBeNull();
    await side.go(0);
    expect(front(side)?.querySelector('.epub-front__shelf')?.textContent).toBe('Novels');
    expect(front(side)?.textContent).toContain('From P and P.epub.');
    // First in the chapter's words, before the book's own.
    expect(side.page.chapter.firstElementChild).toBe(front(side));
    await side.go(3);
    expect(front(side)).toBeNull();
  });

  it('passes over a cover outside the reading order, to the first chapter in it', async () => {
    const items = [
      { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
      { id: 'cover', href: 'cover.xhtml', type: XHTML },
      { id: 'c1', href: 'one.xhtml', type: XHTML },
      { id: 'c2', href: 'two.xhtml', type: XHTML },
    ];
    const book = handEpub('content.opf', [
      {
        name: 'content.opf',
        data: opf('3.0', items, ['cover', 'c1', 'c2']).replace(
          '<itemref idref="cover"/>',
          '<itemref idref="cover" linear="no"/>',
        ),
      },
      {
        name: 'nav.xhtml',
        data: nav([
          ['One', 'one.xhtml'],
          ['Two', 'two.xhtml'],
        ]),
      },
      { name: 'cover.xhtml', data: xhtml('Cover', '<p>The cover.</p>') },
      { name: 'one.xhtml', data: xhtml('One', '<h1>One</h1><p>The first chapter.</p>') },
      { name: 'two.xhtml', data: xhtml('Two', '<h1>Two</h1><p>The second.</p>') },
    ]);
    const { side } = sideWith({ 'b.epub': book });
    await side.open('b.epub');
    expect(side.spine).toBe(1);
    expect(front(side)).not.toBeNull();
    await side.go(0);
    expect(chapterText(side)).toContain('The cover.');
    expect(front(side)).toBeNull();
    await side.go(2);
    expect(front(side)).toBeNull();
  });
});
