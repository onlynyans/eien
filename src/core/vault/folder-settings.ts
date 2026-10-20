// A folder's own settings, in ".eien-folder.json" beside its notes
// (spec §2): the drag-and-drop order, and whether the folder is a book.

import { FOLDER_SETTINGS_NAME, nameKey } from '../paths';
import { withoutBom } from '../text';
import { byName } from './tree';

export { FOLDER_SETTINGS_NAME };

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

/** A change to a folder's settings: a new order, or the folder made a book (or not). */
export interface FolderChange {
  readonly order?: readonly string[];
  readonly book?: FolderSettings['book'];
}

/**
 * The settings file's text with `change` made, every other key kept as it
 * is; null when the file isn't a JSON object (it's never written over — the
 * writer may be part-way through editing it). `text` null is no file yet.
 */
export function withFolderSettings(text: string | null, change: FolderChange): string | null {
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      const parsed: unknown = JSON.parse(withoutBom(text));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
      data = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  // fromEntries keeps a "__proto__" in the file a plain key.
  const next: Record<string, unknown> = Object.fromEntries(Object.entries(data));
  if ('order' in change) {
    if (change.order && change.order.length > 0) next.order = [...change.order];
    else delete next.order;
  }
  if ('book' in change) {
    if (change.book) next.book = change.book;
    else delete next.book;
  }
  return `${JSON.stringify(next, null, 2)}\n`;
}

/** The order with `name` placed just before `before` (last, for null), from the order shown. */
export function placedBefore(
  shown: readonly string[],
  name: string,
  before: string | null,
): string[] {
  const rest = shown.filter((other) => other !== name);
  const at = before === null ? -1 : rest.indexOf(before);
  const index = at < 0 ? rest.length : at;
  return [...rest.slice(0, index), name, ...rest.slice(index)];
}

/** Where `name` is listed in `order`: exactly, or else case and accents aside, as orderNames reads it. */
function listedAt(order: readonly string[], name: string): number {
  const exact = order.indexOf(name);
  return exact >= 0 ? exact : order.findIndex((listed) => nameKey(listed) === nameKey(name));
}

/** `order` with the note `from` now called `to`, in its place. */
export function renamedInOrder(order: readonly string[], from: string, to: string): string[] {
  const at = listedAt(order, from);
  return at < 0 ? [...order] : order.map((name, i) => (i === at ? to : name));
}

/** `order` without the note `name`. */
export function withoutInOrder(order: readonly string[], name: string): string[] {
  const at = listedAt(order, name);
  return at < 0 ? [...order] : order.filter((_, i) => i !== at);
}

/** `order` with only the names that are there (spec §2: missing ones are dropped on the next write). */
export function presentInOrder(order: readonly string[], names: readonly string[]): string[] {
  // orderNames puts the listed names that are there first, spelled as the files are.
  const listed = names.filter((name) => listedAt(order, name) >= 0).length;
  return orderNames(names, order).slice(0, listed);
}
