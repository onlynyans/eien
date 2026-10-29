// The menu bar greyed by what a window shows (#40): the commands it names,
// and a submenu all of whose items are; only the bar's own commands are
// taken; each window's greys worn while it's the focused one.

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Item = {
  id?: string;
  type?: string;
  enabled: boolean;
  submenu?: { items: Item[] };
};
const leaf = (id?: string, type = 'normal'): Item => ({ id, type, enabled: true });
const sub = (...items: Item[]): Item => ({ type: 'submenu', enabled: true, submenu: { items } });
const role = (): Item => ({ type: 'normal', enabled: true });

let bar: Item[] = [];
let focused: unknown = null;
const handlers = new Map<
  string,
  (event: { sender: { id: number } }, ...args: unknown[]) => unknown
>();
vi.mock('electron', () => ({
  Menu: { getApplicationMenu: () => ({ items: bar }) },
  BrowserWindow: { getFocusedWindow: () => focused },
  ipcMain: { handle: (channel: string, handler: never) => handlers.set(channel, handler) },
}));

const { CHANNEL } = await import('../../platform/bridge');
const { greyMenu, menuCommands, serveMenuGrey } = await import('./menu-grey');

/** A bar like the real one: File with Export Note's submenu, Edit with a role, Format. */
const build = () => {
  const exportNote = sub(leaf('export-note:epub'), leaf('export-note:pdf'));
  const file = sub(leaf('new-note'), leaf(undefined, 'separator'), exportNote, leaf('seal'));
  const edit = sub(leaf(), leaf('copy-html'), leaf('find'));
  const format = sub(leaf('format:bold'), leaf(undefined, 'separator'), leaf('format:table'));
  // The system's own: Services, filled by the system, and a Window menu of roles.
  const services = sub();
  const window = sub(role(), role(), services);
  bar = [file, edit, format, window];
  return { file, exportNote, edit, format, window, services };
};
const enabled = (items: Item[]): Record<string, boolean> =>
  Object.fromEntries(items.filter((item) => item.id).map((item) => [item.id, item.enabled]));

beforeEach(() => {
  focused = null;
});

describe('the menu bar greyed by the page in front', () => {
  it('greys the commands named, and a submenu all of whose commands are; the rest on', () => {
    const { file, exportNote, edit, format, window, services } = build();
    greyMenu(
      new Set([
        'seal',
        'export-note:epub',
        'export-note:pdf',
        'copy-html',
        'format:bold',
        'format:table',
      ]),
    );
    expect(enabled(file.submenu?.items ?? [])).toEqual({ 'new-note': true, seal: false });
    expect(exportNote.enabled).toBe(false);
    expect(file.enabled).toBe(true);
    expect(enabled(edit.submenu?.items ?? [])).toEqual({ 'copy-html': false, find: true });
    expect(edit.enabled).toBe(true); // its role (undo) is still on
    // A menu of the bar opens, its items greyed; a submenu with no command of ours is the system's.
    expect(format.enabled).toBe(true);
    expect(enabled(format.submenu?.items ?? [])).toEqual({
      'format:bold': false,
      'format:table': false,
    });
    expect([window, services].every((item) => item.enabled)).toBe(true);
    greyMenu(new Set());
    expect([file, exportNote, edit, format].every((item) => item.enabled)).toBe(true);
    expect(enabled(file.submenu?.items ?? [])).toEqual({ 'new-note': true, seal: true });
  });

  it('takes only the bar’s own commands', () => {
    build();
    expect(menuCommands(['seal', 'format:bold'])).toEqual(new Set(['seal', 'format:bold']));
    expect(menuCommands(null)).toEqual(new Set());
    expect(() => menuCommands(['seal', 'quit'])).toThrow(TypeError);
    expect(() => menuCommands([''])).toThrow(TypeError);
    expect(() => menuCommands('seal')).toThrow(TypeError);
    expect(() => menuCommands([42])).toThrow(TypeError);
  });
});

describe('each window’s greys', () => {
  /** A window as the session sees one: its page's id, and its focus. */
  const fakeWindow = (id: number) => {
    const on = new Map<string, () => void>();
    const window = {
      webContents: { id },
      on: (event: string, listener: () => void) => on.set(event, listener),
      once: (event: string, listener: () => void) => on.set(event, listener),
      focus: () => {
        focused = window;
        on.get('focus')?.();
      },
      close: () => {
        if (focused === window) focused = null;
        on.get('closed')?.();
      },
    };
    return window;
  };
  const tell = (id: number, commands: unknown) =>
    handlers.get(CHANNEL.greyMenu)?.({ sender: { id } }, commands);

  it('wears the focused window’s, and each again as it’s focused', () => {
    const { file } = build();
    const seal = () => file.submenu?.items.find((item) => item.id === 'seal')?.enabled;
    const book = fakeWindow(11);
    const note = fakeWindow(12);
    serveMenuGrey(book as never);
    serveMenuGrey(note as never);
    focused = book;
    tell(11, ['seal']);
    expect(seal()).toBe(false);
    tell(12, []); // not the focused window: kept for later
    expect(seal()).toBe(false);
    note.focus();
    expect(seal()).toBe(true);
    book.focus();
    expect(seal()).toBe(false);
    // The last window closed: the next starts with nothing greyed.
    book.close();
    expect(seal()).toBe(true);
  });

  it('refuses a list with anything else in it, and changes nothing', () => {
    const { file } = build();
    const window = fakeWindow(13);
    serveMenuGrey(window as never);
    expect(() => tell(13, ['seal', 'not-a-command'])).toThrow(TypeError);
    expect(file.submenu?.items.every((item) => item.enabled)).toBe(true);
  });
});
