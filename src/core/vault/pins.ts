// Pinned notes (spec §4): a list of vault paths in ".eien/pinned.json",
// kept with the vault so every device pins the same notes. All Notes in your
// order (".eien/order.json") is a list of paths too, kept the same way.

import { isInside } from '../paths';
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
  pins.map((pin) => (isInside(pin, from) ? to + pin.slice(from.length) : pin));

/** `pins` without `path`, or anything in it. */
export const withoutPins = (pins: readonly string[], path: string): string[] =>
  pins.filter((pin) => !isInside(pin, path));

/**
 * All Notes in your order: the notes not placed yet first, newest first (a
 * new note shows at the top until it's placed), then those `stored` names,
 * as stored (the ones still there).
 */
export function inYourOrder<T extends { readonly path: string; readonly modified: number }>(
  notes: readonly T[],
  stored: readonly string[],
): T[] {
  const byPath = new Map(notes.map((note) => [note.path, note]));
  const placed = stored.flatMap((path) => byPath.get(path) ?? []);
  const listed = new Set(placed.map((note) => note.path));
  const rest = notes
    .filter((note) => !listed.has(note.path))
    .sort((a, b) => b.modified - a.modified || (a.path < b.path ? -1 : 1));
  return [...rest, ...placed];
}
