// The split (spec §4): two pages side by side, the active one the commands
// act on, one note on both sides held once; closing, swapping, ⌘D, ⌘3; and
// the pages folding into one when the pane is too narrow for two.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAGE_MIN } from '../shell/pane-state';
import { noted, pagesWith, typeAtEnd } from './pages-harness';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  localStorage.clear();
});

/** Pages split: Snow on the left, Rain beside it (the active one). */
async function split(files: Record<string, string> = {}) {
  const made = await pagesWith({ 'Snow.md': 'Snow fell.', 'Rain.md': 'Rain came.', ...files });
  stops.push(() => made.pages.stop());
  await made.pages.open('Snow.md');
  await made.pages.open('Rain.md', true);
  return made;
}

/** The pages' row: the pages and the divider in it, left to right (the closed book's edge aside). */
const row = (area: HTMLElement) =>
  [...(area.querySelector('.page__pages')?.children ?? [])]
    .filter((part) => !part.classList.contains('page__edge'))
    .map((part) =>
      part.classList.contains('divider') ? 'divider' : (part.getAttribute('aria-label') ?? 'page'),
    );

describe('opening a note beside the one open', () => {
  it('makes a second page, the active one, with the divider between', async () => {
    const { pages, area } = await split();
    expect(pages.split).toBe(true);
    expect(pages.notes()).toEqual({ active: 'Rain.md', other: 'Snow.md' });
    expect(row(area)).toEqual(['Snow', 'divider', 'Rain, the active page']);
    expect(noted(pages.active).page.editor.text).toBe('Rain came.');
  });

  it('opens on the other page once split, which becomes the active one', async () => {
    const { pages } = await split({ 'Hail.md': 'Hail.' });
    pages.activate(pages.sides[0] as (typeof pages.sides)[number]);
    await pages.open('Hail.md', true);
    expect(pages.notes()).toEqual({ active: 'Hail.md', other: 'Snow.md' });
    expect(pages.sides).toHaveLength(2);
  });

  it('puts the colophon’s words and the running head with the active page', async () => {
    const { pages, area } = await split();
    const words = () => area.querySelector('.colophon .colophon__words')?.textContent;
    expect(words()).toBe('2 words');
    expect(pages.pane.head.querySelector('.running-crumbs')).toBe(pages.active.page.runningCrumbs);
    pages.activate(pages.sides[0] as (typeof pages.sides)[number]);
    expect(pages.notes().active).toBe('Snow.md');
    expect(pages.pane.head.querySelector('.running-crumbs')).toBe(pages.active.page.runningCrumbs);
    expect(area.querySelectorAll('.colophon .colophon__words')).toHaveLength(1);
  });

  it('makes a page active when the writer goes into it', async () => {
    const { pages, rearranged } = await split();
    const before = rearranged();
    const left = pages.sides[0];
    left?.page.element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(pages.active).toBe(left);
    expect(rearranged()).toBe(before + 1); // the window draws the list's chosen row again
  });
});

describe('one note on both pages', () => {
  it('is one session and one document: typed on one page, shown on the other, saved once', async () => {
    const { pages, storage, wrote } = await pagesWith({ 'Snow.md': 'Snow fell.' });
    stops.push(() => pages.stop());
    await pages.open('Snow.md');
    await pages.toggle(); // ⌘D: the note beside itself
    expect(pages.notes()).toEqual({ active: 'Snow.md', other: 'Snow.md' });
    expect(pages.sessions()).toHaveLength(1);
    typeAtEnd(pages, ' The gate held.');
    expect(noted(pages.other).page.editor.text).toBe('Snow fell. The gate held.');
    await pages.flush();
    expect((await storage.read('Snow.md'))?.text).toBe('Snow fell. The gate held.');
    expect(wrote()).toEqual([3]); // counted once, by the page it was typed in
    // The other page's count follows, and adds nothing when its own writer types.
    const other = pages.other;
    if (!other) throw new Error('not split');
    pages.activate(other);
    typeAtEnd(pages, ' Then rain.');
    await pages.flush();
    expect(wrote()).toEqual([3, 2]);
    expect(noted(other).page.words.words).toBe(7);
  });
});

describe('closing a page', () => {
  it('leaves the other page whole and its note as it was, and lets the closed one go', async () => {
    const { pages, area } = await split();
    const rain = noted(pages.active);
    const destroy = vi.spyOn(rain.page.editor.view, 'destroy');
    expect(pages.close(rain)).toBe(true);
    expect(pages.split).toBe(false);
    expect(pages.notes()).toEqual({ active: 'Snow.md', other: null });
    expect(row(area)).toEqual(['page']);
    expect(destroy).toHaveBeenCalled();
    expect(document.querySelectorAll('.selection-bar')).toHaveLength(1);
    // Its note let go once its words are saved.
    await vi.waitFor(() => expect(pages.sessions().map(({ path }) => path)).toEqual(['Snow.md']));
  });

  it('saves the words typed on it, though it closes before typing pauses', async () => {
    const { pages, storage } = await split();
    typeAtEnd(pages, ' The roof held.');
    pages.close(pages.active); // before the save that waits for a pause in the typing
    const saved = async () => (await storage.read('Rain.md'))?.text;
    await vi.waitFor(async () => expect(await saved()).toBe('Rain came. The roof held.'));
  });

  it('holds its note till a save that failed works, then lets it go', async () => {
    const { pages, storage } = await split();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const write = vi.spyOn(storage, 'write').mockRejectedValueOnce(new Error('disk full'));
      typeAtEnd(pages, ' The roof held.');
      pages.close(pages.active);
      await vi.advanceTimersByTimeAsync(0);
      expect(write).toHaveBeenCalledTimes(1);
      expect(pages.sessions().map(({ path }) => path)).toEqual(['Snow.md', 'Rain.md']);
      await vi.advanceTimersByTimeAsync(4000); // the save tried again
      expect((await storage.read('Rain.md'))?.text).toBe('Rain came. The roof held.');
      expect(pages.sessions().map(({ path }) => path)).toEqual(['Snow.md']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never closes the last page', async () => {
    const { pages } = await pagesWith({ 'Snow.md': 'Snow.' });
    stops.push(() => pages.stop());
    expect(pages.close(pages.active)).toBe(false);
    expect(pages.sides).toHaveLength(1);
  });

  it('closes the other page with ⌘D, and gives the keyboard back when it was in the closed one', async () => {
    const { pages } = await split();
    const snow = pages.sides[0];
    await pages.toggle();
    expect(pages.split).toBe(false);
    expect(pages.active).toBe(pages.sides[0]);
    expect(pages.sides[0]).not.toBe(snow); // Rain was active: Snow, the other, closed
    expect(pages.notes().active).toBe('Rain.md');
  });

  it('closes by its ×', async () => {
    const { pages } = await split();
    pages.sides[0]?.page.element.querySelector<HTMLElement>('.sheet__close')?.click();
    expect(pages.notes()).toEqual({ active: 'Rain.md', other: null });
  });
});

describe('swapping and moving between pages', () => {
  it('swaps the pages, the active one staying active', async () => {
    const { pages, area } = await split();
    pages.swap();
    expect(row(area)).toEqual(['Rain, the active page', 'divider', 'Snow']);
    expect(pages.notes().active).toBe('Rain.md');
  });

  it('takes ⌘3 to the other page', async () => {
    const { pages } = await split();
    const focus = vi
      .spyOn(pages.sides[0]?.page as NonNullable<(typeof pages.sides)[0]>['page'], 'focus')
      .mockImplementation(() => {}); // happy-dom has no selection to put the caret in
    pages.focusOther();
    expect(pages.notes().active).toBe('Snow.md');
    expect(focus).toHaveBeenCalled();
  });
});

describe('the pane too narrow for two pages', () => {
  it('folds them into the active one, the pager naming both, and unfolds wider', async () => {
    const { pages, area } = await split();
    // happy-dom has no selection to put a caret in: a page chosen in the pager takes the keyboard.
    for (const { page } of pages.sides) vi.spyOn(page, 'focus').mockImplementation(() => {});
    const row = area.querySelector<HTMLElement>('.page__pages');
    if (!row) throw new Error('no pages');
    let width = 2 * PAGE_MIN - 1;
    vi.spyOn(row, 'clientWidth', 'get').mockImplementation(() => width);
    pages.pane.renamed(); // as a resize does: laid out again
    pages.activate(pages.sides[0] as (typeof pages.sides)[number]);
    expect(row.dataset.narrow === 'fold').toBe(true);
    const pager = pages.pane.pager;
    expect(pager.hidden).toBe(false);
    expect(
      [...pager.querySelectorAll('button')].map((b) => [
        b.textContent,
        b.getAttribute('aria-pressed'),
      ]),
    ).toEqual([
      ['Snow', 'true'],
      ['Rain', 'false'],
    ]);
    pager.querySelectorAll('button')[1]?.click();
    expect(pages.notes().active).toBe('Rain.md');

    width = 2 * PAGE_MIN;
    pages.swap(); // anything that lays them out
    expect(row.dataset.narrow === 'fold').toBe(false);
    expect(pager.hidden).toBe(true);
  });
});

describe('Two pages when narrow', () => {
  it('keeps two pages side by side in a pane too narrow for them, and folds them, live, once off', async () => {
    const { pages, area, change } = await split();
    const pagesRow = area.querySelector<HTMLElement>('.page__pages');
    if (!pagesRow) throw new Error('no pages');
    vi.spyOn(pagesRow, 'clientWidth', 'get').mockImplementation(() => 590); // a Fold 5 upright
    change({ 'appearance.narrowPages': 'on' });
    expect(pagesRow.dataset.narrow).toBeUndefined();
    expect(row(area)).toEqual(['Snow', 'divider', 'Rain, the active page']);
    expect(pages.pane.pager.hidden).toBe(true);
    change({ 'appearance.narrowPages': 'off' });
    expect(pagesRow.dataset.narrow).toBe('fold');
    expect(pages.pane.pager.hidden).toBe(false);
  });

  it('keeps every mode side by side: the book stays open, Tools that follow never waits', async () => {
    for (const mode of ['facing', 'companion', 'follow'] as const) {
      const { area, change } = await split();
      const pagesRow = area.querySelector<HTMLElement>('.page__pages');
      if (!pagesRow) throw new Error('no pages');
      vi.spyOn(pagesRow, 'clientWidth', 'get').mockImplementation(() => 590);
      change({ 'appearance.split': mode, 'appearance.narrowPages': 'on' });
      expect(pagesRow.dataset.narrow, mode).toBeUndefined();
      expect(pagesRow.dataset.dock, mode).toBeUndefined();
      // Each half the room: the companion too, which keeps its own width only where both fit.
      const main = area.querySelector<HTMLElement>('.page__main');
      expect(main?.style.getPropertyValue('--split-share'), mode).toBe('0.5');
    }
  });
});
