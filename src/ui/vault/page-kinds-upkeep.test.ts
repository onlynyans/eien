// What a kind of page keeps up over its pages (./page-side.ts, `PageKindOf`):
// the pages' controller (./pages.ts) hands each kind its own pages alone, and
// a note's page closed while still saving is waited for, whatever took its
// slot. A stand-in second kind (./stand-in-kind.ts) stands for the EPUB's.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { noted, pagesWith, typeAtEnd } from './pages-harness';
import { type StandInSide, standInKind } from './stand-in-kind';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  localStorage.clear();
});

async function made() {
  const m = await pagesWith({ 'Chapter.md': 'The gate held.' }, {}, [standInKind]);
  stops.push(() => m.pages.stop());
  return m;
}

describe('the kinds’ upkeep', () => {
  it('hands each kind its own pages alone, for each step of its upkeep', async () => {
    const { pages } = await pagesWith({ 'Chapter.md': 'The gate held.' }, {}, [standInKind]); // stopped below
    await pages.open('Chapter.md');
    await pages.open('Map.stand', true);
    const [note, stand] = pages.sides;
    const sync = vi.spyOn(standInKind, 'sync');
    const seals = vi.spyOn(noted(note).versions, 'sync');
    pages.sync();
    pages.diskChanged(new Set(['Map.stand']));
    pages.followMoves();
    await pages.flush();
    pages.stop();
    expect(sync).toHaveBeenCalledWith([stand]);
    expect(seals).toHaveBeenCalledTimes(1); // the note's kind reached its own page's seals
    expect((stand as StandInSide).told).toEqual([
      'sync',
      'diskChanged',
      'followMoves',
      'flush',
      'stop',
    ]);
  });

  it('tells a page that left the pane nothing more', async () => {
    const { pages } = await made();
    await pages.open('Map.stand');
    const gone = pages.active as StandInSide;
    pages.sync();
    expect(gone.told).toEqual(['sync']);
    await pages.open('Chapter.md'); // a note takes its slot
    pages.sync();
    expect(gone.disposed).toBe(true);
    expect(gone.told).toEqual(['sync']);
  });

  it('gives a kind with no page in the pane none', async () => {
    const { pages } = await made();
    await pages.open('Chapter.md');
    const flush = vi.spyOn(standInKind, 'flush');
    await pages.flush();
    expect(flush).toHaveBeenCalledWith([]);
  });
});

describe('a note’s page closed while saving', () => {
  it('is waited for by a flush, though another kind’s page took its slot', async () => {
    const { pages, storage } = await made();
    await pages.open('Chapter.md');
    // The disk holds the save till the test lets it go.
    let land = () => {};
    const held = new Promise<void>((resolve) => {
      land = resolve;
    });
    const write = storage.write.bind(storage);
    vi.spyOn(storage, 'write').mockImplementation(async (...args) => {
      await held;
      return write(...args);
    });
    typeAtEnd(pages, ' Then rain.');
    await pages.open('Map.stand'); // the note's page gives its slot up before the typing pauses
    expect(pages.activeNote).toBeNull();
    let flushed = false;
    const flushing = pages.flush().then(() => {
      flushed = true;
    });
    // Long enough for a flush that didn't wait (a per-page one, given no note's page) to resolve.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(flushed).toBe(false); // a quit now waits for the note's words
    land();
    await flushing;
    expect((await storage.read('Chapter.md'))?.text).toBe('The gate held. Then rain.');
  });
});
