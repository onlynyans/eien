import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { name: 'Eien' },
  Menu: { buildFromTemplate: (template: unknown) => template },
}));

const { buildMenu } = await import('./menu');

type Item = {
  id?: string;
  visible?: boolean;
  type?: string;
  label?: string;
  accelerator?: string;
  role?: string;
  submenu?: Item[];
  click?: (...args: unknown[]) => void;
};

/** The File menu built for `platform`, and what its clicks send. */
function fileMenu(platform: NodeJS.Platform) {
  const sent: [string, unknown][] = [];
  const real = process.platform;
  Object.defineProperty(process, 'platform', { value: platform });
  try {
    const menu = buildMenu((command, window) => sent.push([command, window])) as unknown as Item[];
    return { file: menu.find((item) => item.label === 'File')?.submenu ?? [], sent };
  } finally {
    Object.defineProperty(process, 'platform', { value: real });
  }
}
const named = (items: Item[], label: string) => items.find((item) => item.label === label);

describe('the File menu (New Window)', () => {
  for (const platform of ['darwin', 'win32', 'linux'] as const) {
    it(`offers New Window (⇧⌘N) and Eien's own Close Window (⌘W) on ${platform}`, () => {
      const { file, sent } = fileMenu(platform);
      expect(named(file, 'New Window')?.accelerator).toBe('CmdOrCtrl+Shift+N');
      expect(named(file, 'Close Window')?.accelerator).toBe('CmdOrCtrl+W');
      expect(file.some((item) => item.role === 'close')).toBe(false); // the window saves first
      named(file, 'New Window')?.click?.(undefined, undefined);
      named(file, 'Close Window')?.click?.(undefined, 'the window');
      expect(sent).toEqual([
        ['new-window', undefined],
        ['close-window', 'the window'],
      ]);
    });
  }

  it('keeps Quit in the File menu where there’s no app menu', () => {
    expect(fileMenu('win32').file.at(-1)?.role).toBe('quit');
    expect(fileMenu('darwin').file.at(-1)?.label).toBe('Close Window');
  });
});

describe('the View menu (#49)', () => {
  it('offers Look… with ⇧⌘L, sending the quick look’s command', () => {
    const sent: string[] = [];
    const menu = buildMenu((command) => sent.push(command)) as unknown as Item[];
    const view = named(menu, 'View')?.submenu ?? [];
    const look = named(view, 'Look…');
    expect(look?.accelerator).toBe('CmdOrCtrl+Shift+L');
    look?.click?.(undefined, undefined);
    expect(sent).toEqual(['look']);
    // Its key is the Look control's, and no other item's.
    const keys = (items: Item[]): string[] =>
      items.flatMap((item) => [item.accelerator ?? '', ...keys(item.submenu ?? [])]);
    expect(keys(menu).filter((key) => key === 'CmdOrCtrl+Shift+L')).toHaveLength(1);
  });
});

describe('each command’s item (#40: greyed by it)', () => {
  it('is named by the command it sends, a toggle by its setting’s', () => {
    const sent: string[] = [];
    const all = (items: Item[]): Item[] =>
      items.flatMap((item) => [item, ...all(item.submenu ?? [])]);
    const items = all(buildMenu((command) => sent.push(command)) as unknown as Item[]);
    const commands = items.filter((item) => item.click && item.visible !== false);
    expect(commands.length).toBeGreaterThan(40);
    for (const item of commands) {
      item.click?.({ checked: false }, undefined);
      expect(item.id).toBe(sent.at(-1));
    }
    // Each id once: ⌘+'s hidden Zoom In has none of its own.
    const ids = items.flatMap((item) => (item.id ? [item.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
    expect(items.find((item) => item.label === 'Focus Mode')?.id).toBe('toggle:editor.focus');
  });
});

// QA (#40, Phase 4b): B is the page's own key, so the menu's item must never take the letter.
describe('the View menu’s Bookmark This Page (#40, Phase 4b)', () => {
  it('follows Pages and Scroll, sends the bookmark’s command, and has no key of its own', () => {
    const sent: string[] = [];
    const menu = buildMenu((command) => sent.push(command)) as unknown as Item[];
    const view = named(menu, 'View')?.submenu ?? [];
    const labels = view.map((item) => item.label);
    const at = labels.indexOf('Bookmark This Page');
    expect(labels.slice(at - 2, at + 1)).toEqual(['Pages', 'Scroll', 'Bookmark This Page']);
    const item = view[at];
    expect(item?.id).toBe('bookmark');
    expect(item?.accelerator).toBeUndefined();
    item?.click?.(undefined, undefined);
    expect(sent).toEqual(['bookmark']);
    // No item anywhere takes a bare B, which a note's editor types.
    const keys = (items: Item[]): string[] =>
      items.flatMap((each) => [each.accelerator ?? '', ...keys(each.submenu ?? [])]);
    expect(keys(menu).filter((key) => key.toUpperCase() === 'B')).toEqual([]);
  });
});
