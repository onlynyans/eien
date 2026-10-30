import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { countChapter, type Epub, isRefusal, openEpub, pageOf } from '../../core/epub';
import { inflateRaw } from '../../platform/inflate';
import { BookCount, BookCounts, type Still } from './book-count';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);

async function book(name = 'plain.epub'): Promise<Epub> {
  const epub = await openEpub(EPUBS[name] as Uint8Array, inflateRaw);
  if (isRefusal(epub)) throw new Error(epub.detail);
  return epub;
}

const always: Still = (then) => then();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a book counted for its page numbers', () => {
  it('counts every item in the background, one a task, telling each', async () => {
    const epub = await book();
    const count = new BookCount(epub);
    const told = vi.fn();
    count.run(epub, always, told);
    // Nothing in the task that asked: each item in a task of its own.
    expect(count.lengths.every((length) => length === null)).toBe(true);
    await vi.waitFor(() => expect(count.whole).toBe(true));
    expect(told).toHaveBeenCalledTimes(epub.spine.length);
    const chapter = await epub.chapter(1);
    if (isRefusal(chapter)) throw new Error('refused');
    expect(count.lengths[1]).toBe(countChapter(chapter.nodes).length);
  });

  it('counts a drawn chapter as it’s drawn, never reading it again', async () => {
    const epub = await book();
    const read = vi.spyOn(epub, 'chapter');
    const count = new BookCount(epub);
    const drawn = await epub.chapter(2);
    if (isRefusal(drawn)) throw new Error('refused');
    count.add(2, drawn);
    read.mockClear();
    count.run(epub, always, () => {});
    await vi.waitFor(() => expect(count.whole).toBe(true));
    expect(read.mock.calls.map(([index]) => index)).not.toContain(2);
  });

  it('reads nothing while a page turns', async () => {
    const epub = await book();
    const read = vi.spyOn(epub, 'chapter');
    const count = new BookCount(epub);
    // Turning until landed, then still at once, as a page's own turn is.
    let landed: (() => void) | null = null;
    let turning = true;
    count.run(
      epub,
      (then) => {
        if (turning) landed = then;
        else then();
      },
      () => {},
    );
    await new Promise((done) => setTimeout(done, 20));
    expect(read).not.toHaveBeenCalled();
    turning = false;
    landed?.();
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
  });

  it('stops once no page asks, keeping what it counted, and goes on from there', async () => {
    const epub = await book();
    const count = new BookCount(epub);
    const stop = count.run(epub, always, () => stop());
    await new Promise((done) => setTimeout(done, 20));
    expect(count.lengths.filter((length) => length !== null)).toHaveLength(1);
    const read = vi.spyOn(epub, 'chapter');
    count.run(epub, always, () => {});
    await vi.waitFor(() => expect(count.whole).toBe(true));
    expect(read).toHaveBeenCalledTimes(epub.spine.length - 1);
  });

  it('reads from a page still asking, letting go of a book whose page stopped', async () => {
    const one = await book();
    const two = await book();
    const count = new BookCount(one);
    const fromOne = vi.spyOn(one, 'chapter');
    const fromTwo = vi.spyOn(two, 'chapter');
    count.run(one, always, () => {});
    const stopTwo = count.run(two, always, () => {});
    stopTwo();
    await vi.waitFor(() => expect(count.whole).toBe(true));
    expect(fromOne).toHaveBeenCalledTimes(one.spine.length);
    expect(fromTwo).not.toHaveBeenCalled();
  });

  it('counts each item once, however often pages stop and ask again while one is read', async () => {
    const epub = await book();
    const original = epub.chapter.bind(epub);
    let release = () => {};
    // The first item held, being read, until the test lets it go.
    const read = vi.spyOn(epub, 'chapter').mockImplementationOnce(
      (index) =>
        new Promise((done) => {
          release = () => void original(index).then(done);
        }),
    );
    const count = new BookCount(epub);
    const stop = count.run(epub, always, () => {});
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    // Stopped and asked again while the first item is still being read: no second count begins.
    stop();
    count.run(epub, always, () => {});
    await new Promise((done) => setTimeout(done, 20));
    expect(read).toHaveBeenCalledOnce();
    release();
    await vi.waitFor(() => expect(count.whole).toBe(true));
    expect(read).toHaveBeenCalledTimes(epub.spine.length);
  });

  it('reads nothing while any page on the book turns, one joining or turning again meanwhile', async () => {
    const epub = await book();
    const read = vi.spyOn(epub, 'chapter');
    const count = new BookCount(epub);
    // A page whose turn the test lands by hand, and asks again whether it's still.
    const turning = () => {
      let turns = true;
      let landed: (() => void)[] = [];
      const still: Still = (then) => {
        if (turns) landed.push(then);
        else then();
      };
      const land = () => {
        turns = false;
        const waiting = landed;
        landed = [];
        for (const then of waiting) then();
      };
      return { still, land, turn: () => (turns = true) };
    };
    const a = turning();
    count.run(epub, a.still, () => {});
    await new Promise((done) => setTimeout(done, 10));
    // The timer has fired, waiting on A; B joins, turning.
    const b = turning();
    count.run(epub, b.still, () => {});
    a.land();
    await new Promise((done) => setTimeout(done, 10));
    expect(read).not.toHaveBeenCalled();
    // A turns again before B lands: still nothing read.
    a.turn();
    b.land();
    await new Promise((done) => setTimeout(done, 10));
    expect(read).not.toHaveBeenCalled();
    a.land();
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
  });

  it('knows where the printed pages begin in the items it has counted', async () => {
    const epub = await book('page-list.epub');
    const count = new BookCount(epub);
    expect(count.print.map((page) => page.offset)).toEqual([0, null, null, null, null, null]);
    count.run(epub, always, () => {});
    await vi.waitFor(() => expect(count.whole).toBe(true));
    const [xii, one, two, three, four, five] = count.print;
    expect(xii).toEqual({ label: 'xii', spine: 0, offset: 0 });
    expect(one?.offset).toBeGreaterThan(0);
    expect(two).toMatchObject({ label: '2', spine: 1, offset: 0 });
    expect(three?.offset).toBe(count.lengths[1]);
    // Page 4's place is lost from its chapter.
    expect(four).toMatchObject({ label: '4', spine: 2, offset: null });
    expect(five?.offset).toBeGreaterThan(0);
  });
});

describe('the window’s counts', () => {
  it('keep one count per book, the last four asked for', async () => {
    const epub = await book();
    const counts = new BookCounts();
    const first = counts.of(epub);
    expect(counts.of(epub)).toBe(first);
    for (const key of ['b', 'c', 'd']) counts.of({ ...epub, key });
    expect(counts.of(epub)).toBe(first);
    counts.of({ ...epub, key: 'e' });
    counts.of({ ...epub, key: 'f' });
    counts.of({ ...epub, key: 'g' });
    counts.of({ ...epub, key: 'h' });
    expect(counts.of(epub)).not.toBe(first);
  });

  // QA (#40, Phase 4a): the last asked for is kept, not the first made.
  it('keep a book asked for again over one asked for longer ago', async () => {
    const epub = await book();
    const counts = new BookCounts();
    const first = counts.of(epub);
    const older = counts.of({ ...epub, key: 'b' });
    counts.of({ ...epub, key: 'c' });
    counts.of({ ...epub, key: 'd' });
    // Asked again: now the latest. A fifth book lets go of 'b', the oldest asked for.
    counts.of(epub);
    counts.of({ ...epub, key: 'e' });
    expect(counts.of(epub)).toBe(first);
    expect(counts.of({ ...epub, key: 'b' })).not.toBe(older);
  });
});

// QA (#40, Phase 4a): books as a test makes them, each item's words given, `null` an item that won't open.
function madeUp(
  items: readonly ({ words: string; linear?: boolean } | null)[],
  printPages: Epub['printPages'] = [],
): Epub {
  return {
    title: 'Made up',
    author: '',
    language: 'en',
    key: 'made-up',
    spine: items.map((item, i) => ({ path: `c${i}.xhtml`, linear: item?.linear ?? true, size: 1 })),
    contents: [],
    printPages,
    chapter: async (index) => {
      const item = items[index];
      if (!item) return { refused: 'damaged', detail: `no item ${index}` };
      return { nodes: [{ kind: 'text', text: item.words }], images: [] };
    },
    image: async () => ({ refused: 'damaged', detail: 'no pictures' }),
  } as Epub;
}

describe('a book counted, at its edges', () => {
  it('counts a non-linear item (a note) where it stands in the spine, as a printed book prints it', async () => {
    const epub = madeUp([
      { words: 'a'.repeat(1000) },
      { words: 'b'.repeat(700), linear: false },
      { words: 'c' },
    ]);
    const count = new BookCount(epub);
    count.run(epub, always, () => {});
    await vi.waitFor(() => expect(count.whole).toBe(true));
    expect(count.lengths).toEqual([1000, 700, 1]);
    // The third item starts past 1,700 characters: the second page, the note's words among them.
    expect(pageOf(count, 2, 0)).toEqual({ label: 2, of: 2 });
  });

  it('counts a chapter that won’t open as no words, and goes on to the rest', async () => {
    const epub = madeUp([{ words: 'abc' }, null, { words: 'de' }]);
    const count = new BookCount(epub);
    const told = vi.fn();
    count.run(epub, always, told);
    await vi.waitFor(() => expect(count.whole).toBe(true));
    expect(count.lengths).toEqual([3, 0, 2]);
    expect(told).toHaveBeenCalledTimes(3);
  });

  it('leaves out a printed page in a file the spine doesn’t hold, keeping the rest in order', () => {
    const epub = madeUp(
      [{ words: 'abc' }, { words: 'def' }],
      [
        { label: '1', path: 'c0.xhtml', fragment: '' },
        { label: '2', path: 'elsewhere.xhtml', fragment: 'p2' },
        { label: '3', path: 'c1.xhtml', fragment: '' },
      ],
    );
    expect(new BookCount(epub).print).toEqual([
      { label: '1', spine: 0, offset: 0 },
      { label: '3', spine: 1, offset: 0 },
    ]);
  });

  it('counts an item drawn once: drawn again, nothing changes and no page is told', async () => {
    const epub = madeUp([{ words: 'abc' }, { words: 'de' }]);
    const count = new BookCount(epub);
    const told = vi.fn();
    count.run(epub, (then) => void then, told);
    count.add(0, { nodes: [{ kind: 'text', text: 'abc' }], images: [] });
    count.add(0, { nodes: [{ kind: 'text', text: 'a different length' }], images: [] });
    // Out of the spine: nothing to count.
    count.add(5, { nodes: [{ kind: 'text', text: 'x' }], images: [] });
    count.add(-1, { nodes: [{ kind: 'text', text: 'x' }], images: [] });
    expect(count.lengths).toEqual([3, null]);
    expect(told).toHaveBeenCalledOnce();
  });

  it('tells both pages on one book of every item, reading each once', async () => {
    const epub = madeUp([{ words: 'abc' }, { words: 'de' }, { words: 'f' }]);
    const read = vi.spyOn(epub, 'chapter');
    const count = new BookCount(epub);
    const one = vi.fn();
    const two = vi.fn();
    count.run(epub, always, one);
    count.run(epub, always, two);
    await vi.waitFor(() => expect(count.whole).toBe(true));
    expect(read).toHaveBeenCalledTimes(3);
    expect(one).toHaveBeenCalledTimes(3);
    expect(two).toHaveBeenCalledTimes(3);
  });

  it('reads nothing while either page on one book turns', async () => {
    const epub = madeUp([{ words: 'abc' }, { words: 'de' }]);
    const read = vi.spyOn(epub, 'chapter');
    const count = new BookCount(epub);
    let first: (() => void) | null = null;
    let turning = true;
    count.run(epub, always, () => {});
    count.run(
      epub,
      (then) => {
        if (turning) first = then;
        else then();
      },
      () => {},
    );
    await new Promise((done) => setTimeout(done, 20));
    expect(read).not.toHaveBeenCalled();
    turning = false;
    first?.();
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
  });
});
