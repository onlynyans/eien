// Today's tally counts words written (#66): it's set aside while a page no
// words are written on (a book's, LeafFoot.tally false) is the one the
// colophon speaks for (the active page, or Companion's page), and kept while
// a note is; with each page's figures at its own foot (Facing pages), the
// window's while any page shown is a note's.
// A kind that doesn't say (the stand-in, ./stand-in-kind.ts) keeps it.

import { afterEach, describe, expect, it } from 'vitest';
import type { SettingValues } from '../../core/config';
import type { PageKindOf } from './page-side';
import { pagesWith } from './pages-harness';
import { standInKind } from './stand-in-kind';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  localStorage.clear();
});

/** The stand-in as a book is: nothing written on its pages, so no tally. */
const unwritten: PageKindOf = {
  ...standInKind,
  make(hooks, left) {
    const side = standInKind.make(hooks, left);
    Object.assign(side.page.foot, { tally: false });
    return side;
  },
};

async function made(chosen: Partial<SettingValues> = {}, kind = unwritten) {
  const files = { 'Chapter.md': 'The gate held.', 'Notes.md': 'Snow on the walls.' };
  const m = await pagesWith(files, chosen, [kind]);
  stops.push(() => m.pages.stop());
  return m;
}

/** Whether the colophon's counters set today's tally aside. */
const untallied = (area: HTMLElement) =>
  area.querySelector('.colophon__counters')?.hasAttribute('data-untallied');

describe('today’s tally', () => {
  it('is set aside with a book on the one page, and back with a note', async () => {
    const { pages, area } = await made();
    await pages.open('Chapter.md');
    expect(untallied(area)).toBe(false);
    await pages.open('Map.stand');
    expect(untallied(area)).toBe(true);
    await pages.open('Notes.md');
    expect(untallied(area)).toBe(false);
  });

  it('follows the active page in Two sheets', async () => {
    const { pages, area } = await made({ 'appearance.split': 'sheets' });
    await pages.open('Chapter.md');
    await pages.open('Map.stand', true);
    expect(untallied(area)).toBe(true);
    const [note] = pages.sides;
    if (note) pages.activate(note);
    expect(untallied(area)).toBe(false);
  });

  // Companion's colophon is the page's, the companion's figures at its own foot, whichever is active.
  it('follows the page in Companion, never the companion beside it', async () => {
    const { pages, area } = await made({ 'appearance.split': 'companion' });
    await pages.open('Chapter.md');
    await pages.open('Map.stand', true);
    expect(pages.active.kind).toBe('epub');
    expect(untallied(area)).toBe(false);
    pages.swap();
    expect(untallied(area)).toBe(true);
    const note = pages.sides[1];
    if (note) pages.activate(note);
    expect(untallied(area)).toBe(true);
  });

  it('stays with Facing pages while a note is either page, whichever is active', async () => {
    const { pages, area } = await made({ 'appearance.split': 'facing' });
    await pages.open('Chapter.md');
    await pages.open('Map.stand', true);
    // Each page's figures are at its own foot: the colophon's tally is the window's, and a note is shown.
    expect(untallied(area)).toBe(false);
    const [note] = pages.sides;
    if (note) pages.activate(note);
    expect(untallied(area)).toBe(false);
  });

  it('is set aside with Facing pages when both pages are books', async () => {
    const { pages, area } = await made({ 'appearance.split': 'facing' });
    await pages.open('Map.stand');
    await pages.open('Atlas.stand', true);
    expect(pages.sides).toHaveLength(2);
    expect(untallied(area)).toBe(true);
  });

  it('stays for a kind that doesn’t say whether it’s written on', async () => {
    const { pages, area } = await made({}, standInKind);
    await pages.open('Map.stand');
    expect(untallied(area)).toBe(false);
  });
});
