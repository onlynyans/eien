// New Window (spec §4): each window opens another on its own vault, showing a
// note of it or none, and closes itself once it has saved. Each window has
// its own vault, note, panes and split; the vault's folder is shared
// (./vaults.ts).

import type { BrowserWindow, Rectangle } from 'electron';
import { CHANNEL, type WindowStart } from '../../platform/bridge';
import { answer, text } from './ipc';
import type { VaultSession } from './vault-session';

/** What a new window opens on: a vault (the one it was asked from) and a note in it. */
export interface WindowPlace {
  readonly vault: string | null;
  readonly note: string | null;
  /** Where it goes: a step down and across from the window it was asked from. */
  readonly bounds?: Rectangle;
}

/** How far a new window steps down and across from the one it came from, as the system's do. */
export const CASCADE = 24;

/** A step down and across from `bounds`. */
export const cascaded = (bounds: Rectangle): Rectangle => ({
  ...bounds,
  x: bounds.x + CASCADE,
  y: bounds.y + CASCADE,
});

/** `value` as a note's path, or null for none. */
export function notePath(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const path = text(value, 'note');
  if (!path.endsWith('.md')) throw new TypeError('A window opens on a note, or on none.');
  return path;
}

/** Answer the window's own requests: another window, its close, what it opened on. */
export function serveWindow(
  window: BrowserWindow,
  vault: VaultSession,
  start: WindowStart,
  open: (place: WindowPlace) => void,
): void {
  answer(window, CHANNEL.windowOpen, (note) =>
    open({ vault: vault.root, note: notePath(note), bounds: cascaded(window.getBounds()) }),
  );
  answer(window, CHANNEL.windowClose, () => window.close());
  answer(window, CHANNEL.windowStart, () => start);
}
