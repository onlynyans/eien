// A note dragged onto the page pane: beside a lone page past its 60%, onto
// the page it's over otherwise, with a preview of where it would open.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageDrop } from './page-drop';
import { pagesWith } from './pages-harness';

const rect = (left: number, width: number) =>
  ({ left, right: left + width, top: 0, bottom: 800, width, height: 800 }) as DOMRect;

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

async function dropOn(split: boolean) {
  const made = await pagesWith({ 'Snow.md': 'Snow.', 'Rain.md': 'Rain.' });
  const { pages } = made;
  stops.push(() => pages.stop());
  await pages.open('Snow.md');
  if (split) await pages.open('Rain.md', true);
  vi.spyOn(pages.pane.pagesArea, 'getBoundingClientRect').mockReturnValue(rect(200, 1000));
  for (const [at, { page }] of pages.sides.entries())
    vi.spyOn(page.element, 'getBoundingClientRect').mockReturnValue(rect(200 + at * 500, 500));
  const opened: [string, boolean][] = [];
  const drop = pageDrop(pages, (path, beside) => opened.push([path, beside]));
  const label = () => pages.pane.pagesArea.querySelector('.drop-preview')?.textContent;
  return { pages, drop, opened, label };
}

describe('a note dropped on the page pane', () => {
  it('opens beside a lone page when let go past 60% of it, and on it before', async () => {
    const { drop, opened, label } = await dropOn(false);
    expect(drop.over(200 + 700, 100)).toBe(true);
    expect(label()).toBe('Open to the side');
    drop.drop('Hail.md');
    expect(label()).toBeUndefined();
    expect(drop.over(200 + 500, 100)).toBe(true);
    expect(label()).toBe('Open here, in place of Snow');
    drop.drop('Hail.md');
    expect(opened).toEqual([
      ['Hail.md', true],
      ['Hail.md', false],
    ]);
  });

  it('opens on the page it’s over while split, that page made the active one', async () => {
    const { pages, drop, opened, label } = await dropOn(true);
    expect(drop.over(200 + 100, 100)).toBe(true);
    expect(label()).toBe('Open here, in place of Snow');
    drop.drop('Hail.md');
    expect(pages.shown().active).toBe('Snow.md');
    expect(opened).toEqual([['Hail.md', false]]);
  });

  it('shows nothing off the pane, and opens nothing', async () => {
    const { drop, opened, label } = await dropOn(false);
    drop.over(700, 100);
    expect(drop.over(100, 100)).toBe(false);
    expect(label()).toBeUndefined();
    drop.leave();
    expect(opened).toEqual([]);
  });
});
