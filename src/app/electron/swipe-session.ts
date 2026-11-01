// A Mac trackpad's swipe back (#70), as the system's Swipe between pages
// setting has it. Three fingers come as the window's `swipe` event, which
// Electron gives only with that setting on three fingers (or two or three):
// 'left' is back, as browsers take it. Two fingers come to the window as
// sideways wheel events, read there (core/swipe) only when the setting says
// two fingers swipe between pages, so a writer who scrolls sideways keeps it.

import { type BrowserWindow, systemPreferences } from 'electron';
import { CHANNEL } from '../../platform/bridge';
import { answer } from './ipc';

/** Whether two fingers swipe between pages on this system: a Mac's setting, and no one else's. */
export const twoFingersSwipe = (platform: string): boolean =>
  platform === 'darwin' && systemPreferences.isSwipeTrackingFromScrollEventsEnabled();

/** Back to `window` on a swipe back, and whether two fingers swipe there, when it asks. */
export function serveSwipe(window: BrowserWindow, platform = process.platform): void {
  answer(window, CHANNEL.windowSwipes, () => twoFingersSwipe(platform));
  window.on('swipe', (_event, direction) => {
    if (direction === 'left') window.webContents.send(CHANNEL.back);
  });
}
