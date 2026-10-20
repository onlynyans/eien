// A folder's own settings, in ".eien-folder.json" beside its notes
// (spec §2): the drag-and-drop order, and whether the folder is a book.

import { nameKey } from '../paths';
import { withoutBom } from '../text';
import { byName } from './tree';

export const FOLDER_SETTINGS_NAME = '.eien-folder.json';

export interface FolderSettings {
  /** Note names in the writer's order. */
  readonly order: readonly string[];
  /** Present when the folder is a book. */
  readonly book: { readonly goal?: number } | null;
}

export const NO_FOLDER_SETTINGS: FolderSettings = { order: [], book: null };

/**
 * The settings in `text`. Anything missing, malformed or of the wrong type
 * reads as "not set": a damaged file never stops the folder from opening.
 */
export function parseFolderSettings(text: string | null): FolderSettings {
  if (!text) return NO_FOLDER_SETTINGS;
  let data: unknown;
  try {
    data = JSON.parse(withoutBom(text)); // a file saved by an editor that adds a byte-order mark
  } catch {
    return NO_FOLDER_SETTINGS;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return NO_FOLDER_SETTINGS;
  const { order, book } = data as Record<string, unknown>;
  const names = Array.isArray(order) ? order.filter((name) => typeof name === 'string') : [];
  let bookSettings: FolderSettings['book'] = null;
  if (typeof book === 'object' && book !== null && !Array.isArray(book)) {
    const { goal } = book as Record<string, unknown>;
    bookSettings = typeof goal === 'number' && Number.isFinite(goal) && goal > 0 ? { goal } : {};
  }
  return { order: names, book: bookSettings };
}

/**
 * `names` in the folder's order: those listed in `order` first, as listed
 * (each once; listed names that aren't there are skipped), then the rest by
 * name. A listed name matches its file exactly, or else case and accents
 * aside (the order may come from another system). Every name is kept: on
 * Linux and Android "Note.md" and "note.md" are two notes.
 */
export function orderNames(names: readonly string[], order: readonly string[]): string[] {
  const exact = new Set(names);
  const byKey = new Map<string, string[]>();
  for (const name of names) byKey.set(nameKey(name), [...(byKey.get(nameKey(name)) ?? []), name]);
  const placed = new Set<string>();
  for (const listed of order) {
    const name =
      exact.has(listed) && !placed.has(listed)
        ? listed
        : byKey.get(nameKey(listed))?.find((candidate) => !placed.has(candidate));
    if (name !== undefined) placed.add(name);
  }
  return [...placed, ...names.filter((name) => !placed.has(name)).sort(byName)];
}
