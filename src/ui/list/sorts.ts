// The lens over each list, remembered on this device (spec §2: per-device
// state stays out of the vault), in the window's own storage: how it's
// sorted, and the tag filter laid over it (docs/design/explorations/order.md).
// Neither ever changes the list's own order. Beside them, whether a folder's
// list shows its subfolders' notes too (backlog #42).

import { NO_FILTER, readFilter, type TagFilter } from '../../core/tags';
import type { NoteSort, Selection } from '../vault/vault-state';

const SORTS_KEY = 'eien.sorts';
const FILTERS_KEY = 'eien.filters';
const NESTED_KEY = 'eien.subfolders';
const SORTS: readonly NoteSort[] = ['order', 'title', 'modified'];

/** The list a selection shows, as its lens is remembered by. */
export const listKey = (selection: Selection): string =>
  selection.kind === 'folder'
    ? `folder:${selection.path}`
    : selection.kind === 'tag'
      ? `tag:${selection.key}`
      : selection.kind;

function stored(key: string): Record<string, unknown> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function store(key: string, values: Record<string, unknown>): void {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Storage refused: the lens holds until the window closes.
  }
}

/** The sort chosen for a list, if one was. */
export function sortFor(list: string): NoteSort | undefined {
  const sort = stored(SORTS_KEY)[list];
  return SORTS.includes(sort as NoteSort) ? (sort as NoteSort) : undefined;
}

export function rememberSort(list: string, sort: NoteSort | undefined): void {
  const { [list]: _, ...rest } = stored(SORTS_KEY);
  store(SORTS_KEY, sort === undefined ? rest : { ...rest, [list]: sort });
}

/** The tag filter laid over a list; none if there isn't one. */
export const filterFor = (list: string): TagFilter =>
  list in stored(FILTERS_KEY) ? readFilter(stored(FILTERS_KEY)[list]) : NO_FILTER;

export function rememberFilter(list: string, filter: TagFilter): void {
  const { [list]: _, ...rest } = stored(FILTERS_KEY);
  store(FILTERS_KEY, filter.tags.length === 0 ? rest : { ...rest, [list]: filter });
}

/** Whether a list shows its subfolders' notes too: a folder's, when chosen; off until then. */
export const nestedFor = (list: string): boolean => stored(NESTED_KEY)[list] === true;

export function rememberNested(list: string, nested: boolean): void {
  const { [list]: _, ...rest } = stored(NESTED_KEY);
  store(NESTED_KEY, nested ? { ...rest, [list]: true } : rest);
}

/** A folder renamed or moved: the lens of it and of the folders in it follows. */
export function followSorts(from: string, to: string): void {
  for (const key of [SORTS_KEY, FILTERS_KEY, NESTED_KEY]) {
    const moved = Object.entries(stored(key)).map(([list, value]) => {
      const path = list.startsWith('folder:') ? list.slice('folder:'.length) : null;
      const inside = path !== null && (path === from || path.startsWith(`${from}/`));
      return [inside ? `folder:${to}${path.slice(from.length)}` : list, value];
    });
    store(key, Object.fromEntries(moved));
  }
}
