// Where the writer stopped reading (spec §14): for each chapter read, how far
// down it, kept on this browser. The newest are kept, so the list never grows
// past a bound however much is read.

import type { Story } from './story';

export interface Place {
  /** How far down the page, from 0 (its top) to 1 (its end). */
  readonly at: number;
  /** When it was last read there, in milliseconds since 1970. */
  readonly seen: number;
}

export type Places = Readonly<Record<string, Place>>;

/** How many places are kept: the most recently read. */
export const PLACES_KEPT = 500;

/** The page a place belongs to: a chapter of a work, or the whole of it shown at once. */
export function placeKey(story: Story): string {
  const [first] = story.chapters;
  return story.chapters.length > 1 ? `${story.id}/all` : `${story.id}/${first?.number ?? 1}`;
}

const isPlace = (value: unknown): value is Place =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Place).at === 'number' &&
  (value as Place).at >= 0 &&
  (value as Place).at <= 1 &&
  typeof (value as Place).seen === 'number' &&
  Number.isFinite((value as Place).seen);

/** The places kept in `raw` (what storage gave back); anything else is left out. */
export function placesOf(raw: unknown): Places {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([, place]) => isPlace(place)));
}

/** `places` with `key` read to `at` (kept within 0 and 1) at `now`, and only the newest kept. */
export function withPlace(places: Places, key: string, at: number, now: number): Places {
  const place = { at: Math.min(1, Math.max(0, Number.isFinite(at) ? at : 0)), seen: now };
  const rest = Object.entries(places).filter(([other]) => other !== key);
  // The one just read first, whatever another device's clock said of the rest.
  const newest = [[key, place] as const, ...rest.sort(([, a], [, b]) => b.seen - a.seen)].slice(
    0,
    PLACES_KEPT,
  );
  // fromEntries defines each key as data, so a "__proto__" key stays a plain key.
  return Object.fromEntries(newest);
}
