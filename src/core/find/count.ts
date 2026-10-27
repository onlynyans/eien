// What the find bar's count says: which match the selection is on, of how
// many, in plain words.

/** Past this many, counting stops: a count is a glance, not a census. */
export const COUNT_LIMIT = 1000;

export interface FindCount {
  /** The selection's match, from 1; 0 when the selection isn't on one. */
  readonly current: number;
  /** How many there are, at most COUNT_LIMIT. */
  readonly total: number;
  /** More than COUNT_LIMIT. */
  readonly more: boolean;
}

const number = (n: number): string => n.toLocaleString('en');

/**
 * "3 of 12", "12 matches" (none chosen yet), "No matches"; '' with nothing
 * typed; and what's wrong with a pattern that can't be read.
 */
export function countWords(query: string, count: FindCount | 'invalid'): string {
  if (query === '') return '';
  if (count === 'invalid') return 'Not a valid pattern';
  if (count.total === 0) return 'No matches';
  const total = `${number(count.total)}${count.more ? '+' : ''}`;
  if (count.current === 0) return count.total === 1 && !count.more ? '1 match' : `${total} matches`;
  return `${number(count.current)} of ${total}`;
}
