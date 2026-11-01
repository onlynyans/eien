import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (event: { sender: { id: number } }) => unknown>();
const swipeTracking = vi.fn(() => true);
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, handler: never) => handlers.set(channel, handler) },
  systemPreferences: { isSwipeTrackingFromScrollEventsEnabled: () => swipeTracking() },
}));

const { CHANNEL } = await import('../../platform/bridge');
const { serveSwipe } = await import('./swipe-session');

/** A window as the session sees one: its events, and what it sends its page. */
let ids = 0;
const fakeWindow = () => {
  const id = ++ids;
  const events = new Map<string, (event: unknown, direction: string) => void>();
  return {
    webContents: { id, send: vi.fn() },
    once: () => {},
    on: (name: string, listener: (event: unknown, direction: string) => void) =>
      events.set(name, listener),
    swipe: (direction: string) => events.get('swipe')?.({}, direction),
  };
};
const asked = (window: { webContents: { id: number } }) =>
  handlers.get(CHANNEL.windowSwipes)?.({ sender: { id: window.webContents.id } });

beforeEach(() => {
  swipeTracking.mockReturnValue(true);
});

describe('a Mac trackpad’s swipe back (#70)', () => {
  it('sends back for a swipe left, and nothing for the other ways', () => {
    const window = fakeWindow();
    serveSwipe(window as never, 'darwin');
    window.swipe('right');
    window.swipe('up');
    window.swipe('down');
    expect(window.webContents.send).not.toHaveBeenCalled();
    window.swipe('left');
    expect(window.webContents.send).toHaveBeenCalledExactlyOnceWith(CHANNEL.back);
  });

  it('says two fingers swipe only where a Mac’s Swipe between pages says so', () => {
    const mac = fakeWindow();
    serveSwipe(mac as never, 'darwin');
    expect(asked(mac)).toBe(true);
    swipeTracking.mockReturnValue(false);
    expect(asked(mac)).toBe(false);
    const windows = fakeWindow();
    serveSwipe(windows as never, 'win32');
    swipeTracking.mockReturnValue(true);
    expect(asked(windows)).toBe(false);
  });
});
