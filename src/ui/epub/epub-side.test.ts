import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
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
  it('opens the book at its first chapter, named by its title, its folders above', async () => {
    const { side, changed } = sideWith({
      'Novels/P and P.epub': EPUBS['plain.epub'] as Uint8Array,
    });
    await side.open('Novels/P and P.epub');
    expect(side.page.name).toBe('Pride and Prejudice');
    expect(side.page.element.querySelector('.crumbs')?.textContent).toBe('Novels');
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
    kind.moved('Novels', 'Books/Novels');
    kind.followMoves([side]);
    expect(side.path).toBe('Books/Novels/a.epub');
    expect(side.page.element.querySelector('.crumbs')?.textContent).toBe('Books / Novels');
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
