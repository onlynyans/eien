// Companion (spec §4, Split): the page as it always is, and the second note a
// companion beside it with its own head (its name; Make it the page, its ⋯,
// its ×) and foot (its figures), the colophon staying the page's; too narrow,
// the companion goes under the page.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPANION } from '../shell/split-state';
import { pageHosts } from './page-hosts';
import { pageMore } from './page-more';
import { pagesWith } from './pages-harness';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  localStorage.clear();
});

/** A companion: Chapter the page, Notes beside it (the active one, as opened). */
async function companion() {
  const made = await pagesWith(
    { 'Chapter.md': 'The gate held.', 'Notes.md': 'Snow on the walls.' },
    { 'appearance.split': 'companion' },
  );
  stops.push(() => made.pages.stop());
  await made.pages.open('Chapter.md');
  await made.pages.open('Notes.md', true);
  const own = pageHosts({
    pages: made.pages,
    mac: false,
    look: () => ({}),
    press: () => {},
    watch: () => {},
  });
  own.sync();
  return { ...made, own };
}

const labels = (element: Element | undefined) =>
  [...(element?.querySelectorAll('button') ?? [])].map((button) =>
    button.getAttribute('aria-label'),
  );

describe('the companion', () => {
  it('has its own head, its name and its few tools; the page has none', async () => {
    const { pages } = await companion();
    const [page, beside] = pages.sides;
    expect(beside?.page.head.name.textContent).toBe('Notes');
    expect(labels(beside?.page.head.tools)).toEqual([
      'Make it the page',
      'More for this note',
      'Close this page',
    ]);
    expect(labels(page?.page.head.tools)).toEqual([]);
    expect(labels(page?.page.folio.tools)).toEqual([]);
  });

  it('keeps its figures at its foot, and the colophon the page’s, whichever is written in', async () => {
    const { pages, area } = await companion();
    const [page, beside] = pages.sides;
    expect(beside?.page.folio.figures.textContent).toContain('4 words');
    expect(area.querySelector('.colophon .colophon__words')).toBe(page?.page.foot.words);
    expect(pages.active).toBe(beside); // the companion, opened last
  });

  it('becomes the page when made so, its head and foot going to the other', async () => {
    const { pages, own } = await companion();
    pages.swap();
    own.sync();
    const [page, beside] = pages.sides;
    expect(page?.note.path).toBe('Notes.md');
    expect(beside?.page.head.name.textContent).toBe('Chapter');
    expect(labels(beside?.page.head.tools)).toHaveLength(3);
    expect(labels(page?.page.head.tools)).toEqual([]);
  });

  it('goes under the page when the pane is too narrow for both side by side', async () => {
    const { pages, area } = await companion();
    const row = area.querySelector<HTMLElement>('.page__pages');
    if (!row) throw new Error('no pages');
    const room = vi
      .spyOn(row, 'clientWidth', 'get')
      .mockReturnValue(COMPANION.page + COMPANION.least - 1);
    pages.swap();
    expect(row.dataset.dock).toBe('under');
    expect(row.dataset.narrow).toBeUndefined(); // both still show
    expect(
      pages.pane.divider.querySelector('[role="separator"]')?.getAttribute('aria-orientation'),
    ).toBe('horizontal');
    room.mockReturnValue(COMPANION.page + COMPANION.least);
    pages.swap();
    expect(row.dataset.dock).toBeUndefined();
    expect(
      pages.pane.divider.querySelector('[role="separator"]')?.getAttribute('aria-orientation'),
    ).toBe('vertical');
  });
});

describe('the companion’s ⋯', () => {
  it('runs the page’s tools for its own note, making it the active page first', async () => {
    const { pages } = await companion();
    const [page, beside] = pages.sides;
    if (!page || !beside) throw new Error('not split');
    pages.activate(page);
    const run = vi.fn();
    const opened = vi.fn();
    pageMore({ pages, run, openInNewWindow: opened }, beside, document.body);
    const items = [
      ...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"], [role="menuitemradio"]'),
    ];
    expect(items.map((item) => item.textContent?.trim())).toEqual(
      expect.arrayContaining([
        'Live',
        'Source',
        'Reading',
        'Seal',
        'Versions',
        'Compare',
        'Copy as HTML',
        'Open in New Window',
      ]),
    );
    items.find((item) => item.textContent?.includes('Versions'))?.click();
    expect(pages.active).toBe(beside);
    expect(run).toHaveBeenCalledWith('versions');
  });
});
