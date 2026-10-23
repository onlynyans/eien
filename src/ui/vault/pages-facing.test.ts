// Facing pages (spec §4, Split): one sheet opened like a book. Each note's
// figures and own tools at its page's foot (its folio), the colophon keeping
// the book's; the active page marked; too narrow, the book closes to the
// active page, the other's edge beside it to turn to.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAGE_MIN } from '../shell/pane-state';
import { pageHosts } from './page-hosts';
import { pagesWith } from './pages-harness';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  localStorage.clear();
});

/** Facing pages, split: Snow on the left, Rain beside it (the active one). */
async function facing() {
  const made = await pagesWith(
    { 'Snow.md': 'Snow fell.', 'Rain.md': 'Rain came down.' },
    { 'appearance.split': 'facing' },
  );
  stops.push(() => made.pages.stop());
  await made.pages.open('Snow.md');
  await made.pages.open('Rain.md', true);
  return made;
}

const names = (parts: Element | null | undefined) =>
  [...(parts?.children ?? [])].map((part) => part.className);

describe('facing pages’ figures', () => {
  it('puts each note’s words, save and seal at its own page’s foot, the book’s in the colophon', async () => {
    const { pages, area } = await facing();
    for (const { page } of pages.sides)
      expect(names(page.folio.figures)).toEqual([
        'colophon__words',
        'colophon__state',
        'colophon__seal',
      ]);
    expect(pages.sides[0]?.page.folio.figures.textContent).toContain('2 words');
    expect(pages.sides[1]?.page.folio.figures.textContent).toContain('3 words');
    expect(names(area.querySelector('.colophon'))).toEqual([
      'colophon__counters',
      'colophon__zoom',
      'colophon__news',
      'colophon__said',
    ]);
  });

  it('gives the colophon back to the active note as Two sheets, or with one page', async () => {
    const { pages, area, change } = await facing();
    change({ 'appearance.split': 'sheets' });
    expect(area.querySelector('.colophon .colophon__words')).toBe(pages.active.page.foot.words);
    expect(names(pages.sides[0]?.page.folio.figures)).toEqual([]);
    change({ 'appearance.split': 'facing' });
    pages.close(pages.active);
    expect(area.querySelector('.colophon .colophon__words')).toBe(pages.active.page.foot.words);
  });
});

describe('each page’s own tools', () => {
  it('stand in each page’s folio while facing pages are split, and go with Two sheets', async () => {
    const { pages, change } = await facing();
    const look = vi.fn(() => ({}));
    const own = pageHosts({ pages, mac: false, look, press: () => {}, watch: () => {} });
    own.sync();
    for (const side of pages.sides) {
      const labels = [...side.page.folio.tools.querySelectorAll('button')].map((b) =>
        b.getAttribute('aria-label'),
      );
      expect(labels).toEqual(['Compare', 'Seal', 'Versions', 'Copy as HTML', 'Close this page']);
      // Each is shown as it is for its own note.
      expect(look).toHaveBeenCalledWith('compare', side);
    }
    change({ 'appearance.split': 'sheets' });
    own.sync();
    for (const side of pages.sides) expect(side.page.folio.tools.children).toHaveLength(0);
  });
});

describe('the active page’s mark', () => {
  it('lies in the active page alone, and moves with it', async () => {
    const { pages } = await facing();
    const mark = () =>
      pages.sides.map(({ page }) => page.element.querySelectorAll('.page__mark').length);
    expect(mark()).toEqual([0, 1]);
    pages.activate(pages.sides[0] as (typeof pages.sides)[number]);
    expect(mark()).toEqual([1, 0]);
  });

  it('isn’t there with Two sheets', async () => {
    const { pages, change } = await facing();
    change({ 'appearance.split': 'sheets' });
    expect(document.querySelectorAll('.page__mark')).toHaveLength(0);
    expect(pages.split).toBe(true);
  });
});

describe('the book too narrow for two pages', () => {
  it('closes to the active page, the other’s edge naming it, and turns to it', async () => {
    const { pages, area } = await facing();
    for (const { page } of pages.sides) vi.spyOn(page, 'focus').mockImplementation(() => {});
    const row = area.querySelector<HTMLElement>('.page__pages');
    if (!row) throw new Error('no pages');
    vi.spyOn(row, 'clientWidth', 'get').mockReturnValue(2 * PAGE_MIN - 1);
    pages.swap(); // anything that lays them out: Snow is on the right now, Rain still active
    expect(row.dataset.narrow).toBe('close');
    expect(row.dataset.activeSide).toBe('0');
    const edge = row.querySelector<HTMLButtonElement>('.page__edge');
    expect(edge?.getAttribute('aria-label')).toBe('Turn to Snow, the facing page');
    expect(pages.pane.pager.hidden).toBe(true); // a book turns; it doesn't fold
    edge?.click();
    expect(pages.notes().active).toBe('Snow.md');
    expect(row.dataset.activeSide).toBe('1');
  });
});
