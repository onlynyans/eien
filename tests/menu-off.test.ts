// The one rule for a kind's commands (#40): every command the window greys
// with a book in front, or a note (a book's own, Phase 3b) (ui/chrome/commands.ts,
// menuOff) is an item of the
// menu bar on every system, so the main process (app/electron/menu-grey.ts),
// which refuses anything else, greys them all; every format is among them;
// and every other command of the bar is classed as any page's.

import { describe, expect, it, vi } from 'vitest';
import { FORMAT_COMMANDS } from '../src/core/format';

vi.mock('electron', () => ({
  app: { name: 'Eien', isPackaged: true },
  Menu: { buildFromTemplate: (template: unknown) => template },
}));

const { buildMenu } = await import('../src/app/electron/menu');
// The window's module, by a path the Node project's types don't follow (it's the DOM's): what it
// says of commands needs neither.
const WINDOW_COMMANDS = '../src/ui/chrome/commands';
const { menuOff } = (await import(/* @vite-ignore */ WINDOW_COMMANDS)) as {
  menuOff(kind: 'note' | 'epub'): string[];
};

/**
 * The commands that act with any page in front: the window's (new, open, close, Settings, the
 * panes, the split, zoom, sprints, the formatting bar's and spelling's settings), a page's own
 * (Find, Look), and a book's export, which takes the book chosen.
 */
const ANY_PAGE = new RegExp(
  `^(${[
    'new-note',
    'new-window',
    'open-vault',
    'import-folder',
    'close-window',
    'settings',
    'search',
    'look',
    'split',
    'split:swap',
    'find(:.+)?',
    'export-book:.+',
    'sprint:.+',
    'panes:.+',
    'focus:.+',
    'zoom:.+',
    'toggle:editor\\.(formatBar|spellcheck)',
  ].join('|')})$`,
  'u',
);

type Item = { id?: string; submenu?: Item[] };
const ids = (items: Item[]): string[] =>
  items.flatMap((item) => [...(item.id ? [item.id] : []), ...ids(item.submenu ?? [])]);

describe('the commands greyed with a book in front', () => {
  for (const platform of ['darwin', 'win32', 'linux'] as const) {
    it(`are each an item of the menu bar on ${platform}`, () => {
      const real = process.platform;
      Object.defineProperty(process, 'platform', { value: platform });
      try {
        const menu = new Set(ids(buildMenu(() => {}) as unknown as Item[]));
        const off = menuOff('epub');
        // A book's own, greyed with a note in front (Phase 3b), the same way.
        const book = menuOff('note');
        expect([...off, ...book].filter((command) => !menu.has(command))).toEqual([]);
        // Every other command is classed as any page's or the window's: a new one must be too.
        expect(
          [...menu].filter((id) => !off.includes(id) && !book.includes(id) && !ANY_PAGE.test(id)),
        ).toEqual([]);
        for (const { id } of FORMAT_COMMANDS) expect(off).toContain(`format:${id}`);
      } finally {
        Object.defineProperty(process, 'platform', { value: real });
      }
    });
  }
});
