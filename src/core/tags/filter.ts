// The tag filter laid over a list (docs/design/explorations/order.md): each
// tag left alone, wanted, or kept out. A note shows if it has the wanted
// tags (all of them, or any, as chosen) and none of the kept-out ones. A tag
// counts with the tags under it: wanting #fic wants #fic/aot too, as the
// sidebar's #fic lists them.

import { hasTag } from './tree';

export type TagState = 'in' | 'out';
export type TagMatch = 'all' | 'any';

export interface TagFilter {
  /** Each tag (its key, case aside) that isn't left alone, in the order chosen. */
  readonly tags: readonly (readonly [key: string, state: TagState])[];
  /** With two or more wanted: all of them, or any. */
  readonly match: TagMatch;
}

export const NO_FILTER: TagFilter = { tags: [], match: 'all' };

/** Whether `filter` leaves anything out. */
export const filtering = (filter: TagFilter): boolean => filter.tags.length > 0;

/** Whether a note carrying `tags` shows through `filter`. */
export function passes(tags: readonly string[], filter: TagFilter): boolean {
  const wanted = filter.tags.filter(([, state]) => state === 'in').map(([key]) => key);
  const kept = filter.tags.filter(([, state]) => state === 'out').map(([key]) => key);
  if (kept.some((key) => hasTag(tags, key))) return false;
  if (wanted.length === 0) return true;
  return filter.match === 'all'
    ? wanted.every((key) => hasTag(tags, key))
    : wanted.some((key) => hasTag(tags, key));
}

/** A press on a tag: left alone, then wanted, then kept out, then left alone; ⌥ keeps it out at once. */
export function nextState(state: TagState | undefined, out = false): TagState | undefined {
  if (out) return state === 'out' ? undefined : 'out';
  return state === undefined ? 'in' : state === 'in' ? 'out' : undefined;
}

export const stateOf = (filter: TagFilter, key: string): TagState | undefined =>
  filter.tags.find(([one]) => one === key)?.[1];

/** `filter` with the tag `key` set to `state` (undefined: left alone). It keeps its place if it had one. */
export function withTagState(
  filter: TagFilter,
  key: string,
  state: TagState | undefined,
): TagFilter {
  const had = filter.tags.some(([one]) => one === key);
  const tags =
    state === undefined
      ? filter.tags.filter(([one]) => one !== key)
      : had
        ? filter.tags.map(([one, was]) => [one, one === key ? state : was] as const)
        : [...filter.tags, [key, state] as const];
  return { ...filter, tags };
}

/** A filter as stored (this device's, per list), or none for anything else. */
export function readFilter(data: unknown): TagFilter {
  if (typeof data !== 'object' || data === null) return NO_FILTER;
  const { tags, match } = data as { tags?: unknown; match?: unknown };
  const pairs = Array.isArray(tags)
    ? tags.filter(
        (pair): pair is [string, TagState] =>
          Array.isArray(pair) &&
          typeof pair[0] === 'string' &&
          pair[0] !== '' &&
          (pair[1] === 'in' || pair[1] === 'out'),
      )
    : [];
  const unique = [...new Map(pairs.map(([key, state]) => [key, state])).entries()];
  return { tags: unique, match: match === 'any' ? 'any' : 'all' };
}
