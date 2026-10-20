// How the main process answers the window. Each answer is for one window
// only, and ends with it; each argument is checked by the handler.

import { type BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron';

/** Answer `channel` for `window` alone, until the window closes. */
export function answer(
  window: BrowserWindow,
  channel: string,
  fn: (...args: unknown[]) => unknown,
): void {
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (event.sender !== window.webContents) throw new Error('Not this window.');
    return fn(...args);
  });
  window.once('closed', () => ipcMain.removeHandler(channel));
}

/** `value`, which must be text. */
export function text(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be text.`);
  return value;
}
