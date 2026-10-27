// Tools that follow (spec §4, Split): one set of the pane's furniture, over
// the page you're in, placed by the pane's grid; too narrow, the other page
// waits, the colophon saying so; a split asked for without the room refused.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAGE_MIN } from '../shell/pane-state';
import type { PaneLayout } from '../shell/panes';
import { noteActions } from './note-actions';
import { pagesWith } from './pages-harness';
import type { PhoneView } from './phone-view';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  localStorage.clear();
});

async function follow() {
  const made = await pagesWith(
    { 'Chapter.md': 'The gate held.', 'Notes.md': 'Snow on the walls.' },
    { 'appearance.split': 'follow' },
  );
  stops.push(() => made.pages.stop());
  await made.pages.open('Chapter.md');
  return made;
}

describe('tools that follow', () => {
  it('stand over the page you’re in, the bar, formatting bar and colophon moving with you', async () => {
    const { pages, area } = await follow();
    const main = area.querySelector<HTMLElement>('.page__main');
    if (!main) throw new Error('no pane');
    const row = area.querySelector<HTMLElement>('.page__pages');
    vi.spyOn(row as HTMLElement, 'clientWidth', 'get').mockReturnValue(2 * PAGE_MIN + 100);
    await pages.open('Notes.md', true);
    expect(main.dataset.followSide).toBe('1');
    const bar = pages.pane.slots.bar;
    pages.activate(pages.sides[0] as (typeof pages.sides)[number]);
    expect(main.dataset.followSide).toBe('0');
    expect(pages.pane.slots.bar).toBe(bar); // the same element: never moved, the keyboard kept
    expect(main.classList.contains('is-arriving')).toBe(true);
  });

  it('let the other page wait when too narrow, the colophon naming it', async () => {
    const { pages, area } = await follow();
    const row = area.querySelector<HTMLElement>('.page__pages');
    if (!row) throw new Error('no pages');
    vi.spyOn(row, 'clientWidth', 'get').mockReturnValue(2 * PAGE_MIN - 1);
    await pages.open('Notes.md', true);
    expect(row.dataset.narrow).toBe('wait');
    expect(area.querySelector('.page__main')?.hasAttribute('data-follow-side')).toBe(false);
    expect(area.querySelector('.colophon__waits')?.textContent).toMatch(/^Chapter waits · /);
  });
});

describe('a split asked for without the room', () => {
  it('is refused, and says why, where two pages don’t fit beside the sidebar', async () => {
    const { pages } = await follow();
    const told = vi.fn();
    const open = vi.spyOn(pages, 'open');
    const actions = noteActions({
      vault: {} as never,
      state: {} as never,
      nav: {} as never,
      organizer: {} as never,
      pages,
      phone: { stack: { phone: false, splits: true, show: () => {} } } as unknown as PhoneView,
      panes: { listWidth: 300 } as unknown as PaneLayout,
      sidebar: {} as never,
      act: async () => {},
      refresh: async () => {},
      redraw: async () => {},
      tell: told,
      sidebarKey: '⌘\\',
    });
    vi.spyOn(pages.pane.pagesArea, 'clientWidth', 'get').mockReturnValue(2 * PAGE_MIN - 301);
    await actions.openNote('Notes.md', true);
    expect(open).not.toHaveBeenCalled();
    expect(told).toHaveBeenCalledWith(
      'Too narrow for two pages beside the sidebar: shut it (⌘\\) to make room.',
    );
    vi.spyOn(pages.pane.pagesArea, 'clientWidth', 'get').mockReturnValue(2 * PAGE_MIN - 300);
    await actions.openNote('Notes.md', true); // the list's room makes it fit
    expect(open).toHaveBeenCalledWith('Notes.md', true);
  });
});
