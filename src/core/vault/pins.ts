// Pinned notes (spec §4): a list of vault paths in ".eien/pinned.json",
// kept with the vault so every device pins the same notes.

import { withoutBom } from '../text';

/** The pinned paths in the file's text; none for no file or one that can't be read. */
export function parsePins(text: string | null): string[] {
  if (!text) return [];
  try {
    const data: unknown = JSON.parse(withoutBom(text));
    return Array.isArray(data) ? [...new Set(data.filter((path) => typeof path === 'string'))] : [];
  } catch {
    return [];
  }
}

export const pinsText = (pins: readonly string[]): string => `${JSON.stringify(pins, null, 2)}\n`;

/** `pins` with `path` pinned (last) or not. */
export const withPin = (pins: readonly string[], path: string, pinned: boolean): string[] =>
  pinned ? [...pins.filter((pin) => pin !== path), path] : pins.filter((pin) => pin !== path);

/** `pins` after `from` (a note, or a folder and all in it) moved to `to`. */
export const movedPins = (pins: readonly string[], from: string, to: string): string[] =>
  pins.map((pin) =>
    pin === from ? to : pin.startsWith(`${from}/`) ? to + pin.slice(from.length) : pin,
  );

/** `pins` without `path`, or anything in it. */
export const withoutPins = (pins: readonly string[], path: string): string[] =>
  pins.filter((pin) => pin !== path && !pin.startsWith(`${path}/`));
