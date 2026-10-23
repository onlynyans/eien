import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { name: 'Eien' },
  Menu: { buildFromTemplate: (template: unknown) => template },
}));

const { buildMenu } = await import('./menu');

type Item = {
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
