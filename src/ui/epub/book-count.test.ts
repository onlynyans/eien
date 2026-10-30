import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { countChapter, type Epub, isRefusal, openEpub } from '../../core/epub';
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
    let landed = () => {};
    count.run(
      epub,
      (then) => (landed = then),
      () => {},
    );
    await new Promise((done) => setTimeout(done, 20));
    expect(read).not.toHaveBeenCalled();
    landed();
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
});
