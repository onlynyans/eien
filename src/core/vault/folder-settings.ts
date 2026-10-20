// A folder's own settings, in ".eien-folder.json" beside its notes
// (spec §2): the drag-and-drop order, and whether the folder is a book.

import { nameKey } from '../paths';
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
    data = JSON.parse(text);
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
 * name.
 */
export function orderNames(names: readonly string[], order: readonly string[]): string[] {
  const present = new Map(names.map((name) => [nameKey(name), name]));
  const ordered: string[] = [];
  for (const listed of order) {
    const key = nameKey(listed);
    const name = present.get(key);
    if (name !== undefined) {
      ordered.push(name);
      present.delete(key);
    }
  }
  return [...ordered, ...[...present.values()].sort(byName)];
}
