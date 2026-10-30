// The quick look as a shown vault wires it (./chrome-wiring.ts): the menu's
// Look (⇧⌘L, View → Look…, the control, a ⋯'s) opens the active page's look
// under its control; a page of another kind has none yet (#40 Phase 1 gives
// the shelf one); choosing the other page closes it.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MenuCommand } from '../../platform/bridge';
import * as menuModule from '../menu/menu';
import { closeMenu } from '../menu/menu';
import type { MenuBus } from '../menu/menu-bus';
import type { PaneLayout } from '../shell/panes';
import type { Sidebar } from '../sidebar/sidebar';
import { vaultChrome } from './chrome-wiring';
import type { Side } from './pages';
import { pagesWith } from './pages-harness';
import type { PhoneView } from './phone-view';
import { standInKind } from './stand-in-kind';

const stops: (() => void)[] = [];
afterEach(() => {
  closeMenu();
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  localStorage.clear();
});

/** A note, and beside it if asked the stand-in kind (or a second note), the window's tools drawn over them. */
async function shown(beside: boolean | string = false, split: 'sheets' | 'companion' = 'sheets') {
  const files = { 'Chapter.md': 'The gate held.', 'Notes.md': 'And then.' };
  const look = { 'appearance.layout': 'band', 'appearance.split': split } as const;
  const made = await pagesWith(files, look, [standInKind]);
  await made.pages.open('Chapter.md');
  if (beside) await made.pages.open(beside === true ? 'Map.stand' : beside, true);
  const listeners = new Set<(command: MenuCommand) => void>();
  const menu = {
    on: (listener: (command: MenuCommand) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    run: (command: MenuCommand) => {
      for (const listener of listeners) listener(command);
    },
  } as unknown as MenuBus;
  const div = () => document.createElement('div');
  const chrome = vaultChrome({
    shell: document.body.appendChild(div()),
    pages: made.pages,
    sidebar: {
      foot: { controls: div(), sync: div() },
      adders: [],
      lens: { tools: div(), chips: div() },
    } as unknown as Sidebar,
    panes: { isShut: () => false, aside: false, two: false } as unknown as PaneLayout,
    phone: { stack: { controls: div(), phone: false }, more: () => {} } as unknown as PhoneView,
    settings: made.settings,
    menu,
    mac: true,
    platform: 'darwin',
  });
  chrome.mount();
  stops.push(() => {
    chrome.stop();
    made.pages.stop();
  });
  const control = () =>
    made.pages.pane.slots.bar.querySelector<HTMLButtonElement>('[data-command="look"]');
  const popover = () => document.querySelector<HTMLElement>('.quick-look');
  return { ...made, chrome, menu, control, popover };
}

describe('the Look control', () => {
  it('opens the notes’ look under it from the menu’s Look, and closes it from the menu again', async () => {
    const { menu, control, popover } = await shown();
    expect(control()?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(control()?.getAttribute('aria-expanded')).toBe('false');
    menu.run('look');
    expect(popover()?.getAttribute('aria-label')).toBe('Look: Notes');
    expect(control()?.getAttribute('aria-expanded')).toBe('true');
    menu.run('look');
    expect(popover()).toBeNull();
    expect(control()?.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens when it’s pressed, and says so in its look', async () => {
    const { control, popover } = await shown();
    control()?.click();
    expect(popover()).not.toBeNull();
    expect(control()?.getAttribute('aria-expanded')).toBe('true');
  });

  it('hangs under the strip’s control while the band is put away, its own out of sight', async () => {
    const { menu, chrome, popover } = await shown();
    const strip = () => document.querySelector<HTMLButtonElement>('[data-command="strip"]');
    const float = vi.spyOn(menuModule, 'float');
    // The band put away: its tools aren't drawn (band.css), the strip's control alone is.
    strip()?.click();
    await Promise.resolve();
    chrome.refresh();
    for (const button of document.querySelectorAll<HTMLElement>('[data-command]'))
      button.checkVisibility = () => button.dataset.command === 'strip';
    menu.run('look');
    expect(popover()).not.toBeNull();
    expect(float.mock.calls.at(-1)?.[1].opener).toBe(strip());
    float.mockRestore();
  });

  it('sets the shelf’s look with a book in front: LOOK / SHELF, every book on the shelf (#40)', async () => {
    const { menu, control, popover } = await shown(true);
    expect(control()?.disabled).toBe(false);
    menu.run('look');
    expect(popover()?.getAttribute('aria-label')).toBe('Look: Shelf');
    expect(popover()?.textContent).toContain('every book on the shelf');
  });

  it('says under the shelf’s look that Settings sets notes; the notes’ look says nothing of it', async () => {
    const { menu, pages, chrome, popover } = await shown(true);
    const line = () => popover()?.querySelector('.quick-look__line') ?? null;
    menu.run('look');
    expect(line()?.textContent).toBe('Settings sets notes; this is every book’s look.');
    expect(popover()?.getAttribute('aria-describedby')).toBe(line()?.id);
    expect(line()?.parentElement?.classList.contains('quick-look__foot')).toBe(true);
    menu.run('look');
    pages.activate(pages.sides[0] as Side);
    chrome.refresh();
    menu.run('look');
    expect(popover()?.getAttribute('aria-label')).toBe('Look: Notes');
    expect(line()).toBeNull();
    expect(popover()?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('closes when the other page becomes the one you’re in', async () => {
    const { menu, pages, chrome, popover } = await shown(true);
    pages.activate(pages.sides[0] as Side);
    chrome.refresh();
    menu.run('look');
    expect(popover()).not.toBeNull();
    pages.activate(pages.sides[1] as Side);
    chrome.refresh();
    expect(popover()).toBeNull();
  });
});

describe('the page the look doesn’t change (#49)', () => {
  const back = (pages: { sides: readonly Side[] }) =>
    pages.sides.map((side) => side.page.element.hasAttribute('data-back'));

  it('sits back while the look is open with a note and a book side by side, and comes forward as it closes', async () => {
    const { menu, pages, chrome } = await shown(true);
    expect(back(pages)).toEqual([false, false]);
    menu.run('look'); // the book's, the active page
    expect(back(pages)).toEqual([true, false]);
    menu.run('look');
    expect(back(pages)).toEqual([false, false]);
    pages.activate(pages.sides[0] as Side);
    chrome.refresh();
    menu.run('look'); // the notes'
    expect(back(pages)).toEqual([false, true]);
    closeMenu();
    expect(back(pages)).toEqual([false, false]);
  });

  it('with a companion, opens for the page itself, which becomes the one you’re in; the companion sits back', async () => {
    const { menu, pages } = await shown(true, 'companion');
    const [page, companion] = pages.sides as [Side, Side];
    expect(pages.active).toBe(companion); // the stand-in, beside
    menu.run('look'); // the menu's Look acts on the page itself, a note
    expect(pages.active).toBe(page);
    expect(back(pages)).toEqual([false, true]);
  });

  it('never sits back beside a page of its own kind: two notes wear the one look', async () => {
    const { menu, pages } = await shown('Notes.md');
    menu.run('look');
    expect(back(pages)).toEqual([false, false]);
  });
});
