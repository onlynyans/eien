// A sprint (spec §4): a stretch of minutes against the clock, and the words
// gained in it. It ends quietly: no sound, no window, only the colophon
// saying so (spec §1: nothing interrupts the writer).

export interface Sprint {
  /** When it ends: milliseconds since the epoch. */
  readonly ends: number;
  readonly minutes: number;
  /** The words gained so far, net, as today's tally counts them. */
  readonly words: number;
}

/** The lengths the menu offers, in minutes. */
export const SPRINT_MINUTES = [10, 15, 25, 30, 45, 60] as const;
export type SprintMinutes = (typeof SPRINT_MINUTES)[number];

export const startSprint = (now: number, minutes: SprintMinutes): Sprint => ({
  ends: now + minutes * 60_000,
  minutes,
  words: 0,
});

/** When it began. */
export const sprintStart = (sprint: Sprint): number => sprint.ends - sprint.minutes * 60_000;

/** The time left, in milliseconds: none once it's over, never more than its length (a clock set back). */
export const sprintLeft = (sprint: Sprint, now: number): number =>
  Math.min(sprint.minutes * 60_000, Math.max(0, sprint.ends - now));

/** Whether writing from `from` to `to` (milliseconds) fell in the sprint, any of it. */
export const inSprint = (sprint: Sprint, from: number, to: number): boolean =>
  from < sprint.ends && to >= sprintStart(sprint);

/** Time left as a clock: "24:59", "0:05"; a part second counts as a whole one. */
export function clock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** A sprint as it was kept, or null for anything that isn't one. */
export function readSprint(raw: unknown): Sprint | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { ends, minutes, words } = raw as Record<string, unknown>;
  const known = (SPRINT_MINUTES as readonly unknown[]).includes(minutes);
  return Number.isSafeInteger(ends) && known && Number.isSafeInteger(words)
    ? { ends: ends as number, minutes: minutes as SprintMinutes, words: words as number }
    : null;
}
