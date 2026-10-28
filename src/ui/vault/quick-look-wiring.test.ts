// The quick look as a shown vault wires it (./chrome-wiring.ts): the menu's
// Look (⇧⌘L, View → Look…, the control, a ⋯'s) opens the active page's look
// under its control; a page of another kind has none yet (#40 Phase 1 gives
// the shelf one); choosing the other page closes it.

import { afterEach, describe, expect, it } from 'vitest';
import type { MenuCommand } from '../../platform/bridge';
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

/** A note, and the stand-in kind beside it if `beside`, the window's tools drawn over them. */
async function shown(beside = false) {
  const files = { 'Chapter.md': 'The gate held.', 'Notes.md': 'And then.' };
  const made = await pagesWith(files, { 'appearance.layout': 'band' }, [standInKind]);
  await made.pages.open('Chapter.md');
  if (beside) await made.pages.open('Map.stand', true);
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

  it('is off, and the menu’s Look does nothing, while the active page holds another kind', async () => {
    const { menu, control, popover } = await shown(true);
    expect(control()?.disabled).toBe(true);
    menu.run('look');
    expect(popover()).toBeNull();
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
