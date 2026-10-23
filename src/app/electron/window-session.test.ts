import { describe, expect, it, vi } from 'vitest';

const handlers = new Map<
  string,
  (event: { sender: { id: number } }, ...args: unknown[]) => unknown
>();
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, handler: never) => handlers.set(channel, handler) },
}));

const { CHANNEL } = await import('../../platform/bridge');
const { CASCADE, cascaded, notePath, serveWindow } = await import('./window-session');

/** A window as the session sees one: its page's id, its place, its close. */
const fakeWindow = (id: number) => ({
  webContents: { id },
  once: () => {},
  getBounds: () => ({ x: 100, y: 80, width: 1280, height: 800 }),
  close: vi.fn(),
});
const call = (channel: string, id: number, ...args: unknown[]) =>
  handlers.get(channel)?.({ sender: { id } }, ...args);

describe('New Window: a window’s own requests', () => {
  it('opens another on this window’s vault and the note asked for, a step down and across', () => {
    const opened: unknown[] = [];
    const window = fakeWindow(1);
    serveWindow(window as never, { root: '/Vault' } as never, { note: null }, (place) =>
      opened.push(place),
    );
    call(CHANNEL.windowOpen, 1, 'Fic/Ideas.md');
    call(CHANNEL.windowOpen, 1, null);
    expect(opened).toEqual([
      {
        vault: '/Vault',
        note: 'Fic/Ideas.md',
        bounds: { x: 100 + CASCADE, y: 80 + CASCADE, width: 1280, height: 800 },
      },
      {
        vault: '/Vault',
        note: null,
        bounds: { x: 100 + CASCADE, y: 80 + CASCADE, width: 1280, height: 800 },
      },
    ]);
  });

  it('tells a window what it was opened on, and closes the one that asks', () => {
    const window = fakeWindow(2);
    serveWindow(window as never, { root: '/Vault' } as never, { note: 'Ideas.md' }, () => {});
    expect(call(CHANNEL.windowStart, 2)).toEqual({ note: 'Ideas.md' });
    call(CHANNEL.windowClose, 2);
    expect(window.close).toHaveBeenCalledOnce();
  });

  it('opens a window on a note, or on none, and refuses anything else', () => {
    expect(notePath('Fic/Ideas.md')).toBe('Fic/Ideas.md');
    expect(notePath(null)).toBeNull();
    expect(notePath(undefined)).toBeNull();
    expect(() => notePath('Fic/picture.png')).toThrow('A window opens on a note');
    expect(() => notePath(42)).toThrow(TypeError);
  });

  it('steps a new window down and across from the one it came from', () => {
    expect(cascaded({ x: 0, y: 0, width: 800, height: 600 })).toEqual({
      x: CASCADE,
      y: CASCADE,
      width: 800,
      height: 600,
    });
  });
});
