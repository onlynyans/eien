// The window's settings changes, answered in the main process: quick changes
// (⌘+ held down) leave every window as the last one says, though the reads
// behind their answers finish out of order (a slow disk: Windows).

import { describe, expect, it, vi } from 'vitest';

const handlers = new Map<
  string,
  (event: { sender: { id: number } }, ...args: unknown[]) => unknown
>();
const zoomed: number[] = [];
let windows: unknown[] = [];
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, handler: never) => handlers.set(channel, handler) },
  BrowserWindow: { getAllWindows: () => windows },
  nativeTheme: { themeSource: 'system' },
}));
vi.mock('./frame', () => ({ zoomWindow: (_: unknown, factor: number) => zoomed.push(factor) }));
vi.mock('./menu', () => ({ checkToggles: () => {} }));

/** This device's file in memory; each read waits until the test lets it finish. */
let file: { settings?: Record<string, unknown> } = {};
const reads: (() => void)[] = [];
vi.mock('./device-settings', () => ({
  readDeviceFile: () => {
    const now = structuredClone(file); // what the disk holds as the read begins
    return new Promise((done) => reads.push(() => done(now)));
  },
  updateDeviceFile: async (change: (data: typeof file) => typeof file) => {
    file = change(file);
  },
}));

const { CHANNEL } = await import('../../platform/bridge');
const { serveSettings } = await import('./settings-session');

describe('quick changes', () => {
  it('zoom every window as the last change says, though an older read finishes after it', async () => {
    const window = { webContents: { id: 1, send: vi.fn() }, once: () => {} };
    windows = [window];
    serveSettings(window as never, { open: null } as never);
    const set = (zoom: number) =>
      handlers.get(CHANNEL.settingsSet)?.({ sender: { id: 1 } }, 'window.zoom', zoom);
    const older = set(160);
    await vi.waitFor(() => expect(reads).toHaveLength(1));
    const newer = set(170);
    await vi.waitFor(() => expect(reads).toHaveLength(2));
    reads[1]?.(); // the newer change's read finishes first
    await newer;
    reads[0]?.(); // then the older one's, read before 170 was written
    await older;
    expect(zoomed.at(-1)).toBe(1.7);
  });
});
