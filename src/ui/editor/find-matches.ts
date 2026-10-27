// What the find bar reads from the editor's state: how many matches the query
// has, which one the selection is on, and where typing a query goes first.
// CodeMirror's search (@codemirror/search) finds them; the counting is Eien's.

import type { SearchQuery } from '@codemirror/search';
import type { EditorState } from '@codemirror/state';
import { COUNT_LIMIT, type FindCount } from '../../core/find';

export interface Match {
  readonly from: number;
  readonly to: number;
}

/** How many matches `query` has in `state` (up to COUNT_LIMIT), and which the main selection is. */
export function countMatches(state: EditorState, query: SearchQuery): FindCount | 'invalid' {
  if (!query.valid) return query.search === '' ? { current: 0, total: 0, more: false } : 'invalid';
  const { from, to } = state.selection.main;
  const cursor = query.getCursor(state);
  let total = 0;
  let current = 0;
  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    if (total === COUNT_LIMIT) return { current, total, more: true };
    total++;
    if (next.value.from === from && next.value.to === to) current = total;
  }
  return { current, total, more: false };
}

/**
 * The first match at or after `at`, or else the first in the note: where a
 * query being typed goes, so each letter narrows from the same place rather
 * than stepping on past it.
 */
export function firstMatchFrom(state: EditorState, query: SearchQuery, at: number): Match | null {
  if (!query.valid) return null;
  const after = query.getCursor(state, at).next();
  if (!after.done) return { from: after.value.from, to: after.value.to };
  const first = query.getCursor(state, 0, at).next();
  return first.done ? null : { from: first.value.from, to: first.value.to };
}
