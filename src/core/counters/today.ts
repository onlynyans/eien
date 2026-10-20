// Today's words (spec §4; per device, §2): the words written on this device
// today, net — what's typed less what's cut, so it can fall below nothing.
// Only the writer's own changes count; a reload, a seal or a restore isn't
// writing. A new day starts the tally again.

export interface Tally {
  /** The day it counts, on this device's clock: "2026-10-20". */
  readonly day: string;
  readonly words: number;
}

/** The day `now` falls on, on this device's clock. */
export function dayOf(now: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/** Milliseconds from `now` to the next midnight, on this device's clock. */
export function untilMidnight(now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime();
}

/** The words counted today, by `tally`: none when it counts another day. */
export const todayWords = (tally: Tally | null, now: Date): number =>
  tally && tally.day === dayOf(now) ? tally.words : 0;

/** `tally` with `delta` words more (or fewer), started again on a new day. */
export const tallied = (tally: Tally | null, now: Date, delta: number): Tally => ({
  day: dayOf(now),
  words: todayWords(tally, now) + delta,
});

/** A tally as it was kept, or null for anything that isn't one. */
export function readTally(raw: unknown): Tally | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { day, words } = raw as Record<string, unknown>;
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(day) && Number.isSafeInteger(words)
    ? { day, words: words as number }
    : null;
}

/** A count with its sign: "+809", "−12", "0". */
export function signed(words: number): string {
  if (words === 0) return '0';
  return `${words > 0 ? '+' : '−'}${Math.abs(words).toLocaleString()}`;
}
