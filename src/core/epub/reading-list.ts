// A list kept in a book's reading state's file (./reading.ts): its
// bookmarks (Phase 4b, ./bookmarks.ts), and its highlights (Phase 5). Read
// for the items this Eien can, the first few it shows; changed in place in
// the file's own array, so an item this Eien can't read, or a field it
// doesn't know, is kept as it is, and the field stays where it stands among
// the file's others (no change but the one asked for in a synced file). A
// file a newer Eien wrote, or one that can't be read, is never written.

import { READING_VERSION, readingFile, writable } from './reading';

/** How one kind of item is read from the file, and told apart. */
export interface ListKind<T> {
  /** The file's field holding the list. */
  readonly field: string;
  /** An item from the file, or null for one this Eien can't read. */
  read(item: unknown): T | null;
  /** Whether two items are one. */
  same(a: T, b: T): boolean;
}

/** A change to a list: one item added (unless it's there), some taken off. */
export interface ListChange<T> {
  readonly add?: T;
  readonly remove?: readonly T[];
}

/** The items the file's text holds that this Eien can read, the first `max` of them. */
export function listIn<T>(text: string | null, kind: ListKind<T>, max: number): T[] {
  const list = readingFile(text)?.[kind.field];
  if (!Array.isArray(list)) return [];
  const items: T[] = [];
  for (const item of list) {
    if (items.length === max) break;
    const read = kind.read(item);
    if (read) items.push(read);
  }
  return items;
}

/**
 * The file's text with `change` made to its list, every other item and
 * field as it was and where it was; null when the file can't be written
 * (./reading.ts writable).
 */
export function withList<T>(
  text: string | null,
  kind: ListKind<T>,
  change: ListChange<T>,
): string | null {
  const file = writable(text);
  if (!file) return null;
  const was: unknown[] = Array.isArray(file[kind.field]) ? (file[kind.field] as unknown[]) : [];
  const matches = (item: unknown, other: T) => {
    const read = kind.read(item);
    return read !== null && kind.same(read, other);
  };
  const kept = was.filter((item) => !(change.remove ?? []).some((gone) => matches(item, gone)));
  const { add } = change;
  const list = add && !kept.some((item) => matches(item, add)) ? [...kept, { ...add }] : kept;
  // The file spread first, so each field keeps its place (the version first in a new file), then
  // the version this Eien writes, where the file had it.
  const next: Record<string, unknown> = { version: READING_VERSION, ...file, [kind.field]: list };
  next.version = READING_VERSION;
  return `${JSON.stringify(next, null, 2)}\n`;
}
