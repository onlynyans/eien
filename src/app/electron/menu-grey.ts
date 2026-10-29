// The menu bar's commands greyed by what a window shows (#40): a note's do
// nothing with a book in front. The window says which (ui/chrome/commands.ts's
// menuOff, from each command's `on`); the menu bar is the whole app's, so it
// wears the focused window's, and each window's is kept for when it's focused.

import { BrowserWindow, Menu, type MenuItem } from 'electron';
import { CHANNEL } from '../../platform/bridge';
import { answer, texts } from './ipc';

/** Every item of `items` and their submenus. */
const allOf = (items: readonly MenuItem[]): MenuItem[] =>
  items.flatMap((item) => [item, ...allOf(item.submenu?.items ?? [])]);

/**
 * Grey the commands in `off` (each item's id is its command, ./menu.ts), and a submenu whose
 * commands all are (Export Note); every other command on. A menu of the bar is never greyed, as
 * the system's guidelines have it: it opens, its items greyed.
 */
export function greyMenu(off: ReadonlySet<string>): void {
  /** Whether `items` hold a command, and whether any is on. */
  const walk = (items: readonly MenuItem[]): { commands: boolean; on: boolean } => {
    let commands = false;
    let on = false;
    for (const item of items) {
      const inner = item.submenu?.items;
      if (inner) {
        const below = walk(inner);
        item.enabled = !below.commands || below.on;
        commands ||= below.commands;
        on ||= below.on;
      } else if (item.id) {
        item.enabled = !off.has(item.id);
        commands = true;
        on ||= item.enabled;
      }
    }
    return { commands, on };
  };
  for (const menu of Menu.getApplicationMenu()?.items ?? []) {
    menu.enabled = true;
    walk(menu.submenu?.items ?? []);
  }
}

/** `value` as commands the menu bar has, or a TypeError: nothing else is greyed. */
export function menuCommands(value: unknown): Set<string> {
  const known = new Set(allOf(Menu.getApplicationMenu()?.items ?? []).map((item) => item.id));
  const commands = texts(value, 'The commands') ?? [];
  if (commands.some((command) => !command || !known.has(command)))
    throw new TypeError('Only the menu bar’s commands can be greyed.');
  return new Set(commands);
}

/** Each window's greyed commands. */
const greyed = new WeakMap<BrowserWindow, ReadonlySet<string>>();

/** Answer a window's greyed commands, and wear them while it's the one focused. */
export function serveMenuGrey(window: BrowserWindow): void {
  answer(window, CHANNEL.greyMenu, (value) => {
    const off = menuCommands(value);
    greyed.set(window, off);
    const focused = BrowserWindow.getFocusedWindow();
    if (!focused || focused === window) greyMenu(off);
  });
  window.on('focus', () => greyMenu(greyed.get(window) ?? new Set()));
  // The last window closed (macOS keeps the menu bar): nothing greyed for the next.
  window.once('closed', () => {
    if (!BrowserWindow.getFocusedWindow()) greyMenu(new Set());
  });
}
