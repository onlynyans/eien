// Where the divider between two pages stands (the split, spec §4), as each
// mode measures it, remembered on this device as the panes' widths are
// (./pane-state.ts): two pages share the pane (the left one's share); a
// companion keeps its own width beside the page, or its share of the height
// under it. Each measure says how a value is shown in a room of so many
// pixels (as the share of the room before the divider) and how a move or an
// even changes it. Only the arithmetic is here; ../page/divider.ts draws it.

import { PAGE_MIN } from './pane-state';

export interface Measure {
  /** Where its value is kept on this device. */
  readonly key: string;
  /** Side by side (x), or one over the other (y). */
  readonly axis: 'x' | 'y';
  /** Its value evened: where it starts, and where a double-click or Enter puts it. */
  readonly even: number;
  /** The value as stored; anything missing or out of its range is even. */
  read(text: string | null): number;
  /** The share of `room` before the divider, as `value` is shown there. */
  shown(value: number, room: number): number;
  /** `value` moved `by` pixels (right or down) in `room`, from where it's shown. */
  moved(value: number, room: number, by: number): number;
}

/** A companion beside the page (Companion): its width, and the page's beside it. */
export const COMPANION = { width: 380, least: 300, page: 400 } as const;
/** Under the page, too narrow to stand beside: its share of the height, between these. */
const UNDER = { even: 0.42, least: 0.25, most: 0.7 } as const;

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** A stored `{ value }` read, or even where it isn't one `ok` takes. */
function readValue(text: string | null, even: number, ok: (value: number) => boolean): number {
  let data: unknown;
  try {
    data = JSON.parse(text ?? 'null');
  } catch {
    return even;
  }
  const value = (data as { value?: unknown } | null)?.value;
  return finite(value) && ok(value) ? value : even;
}

const clamp = (value: number, least: number, most: number) =>
  Math.min(most, Math.max(least, value));

/** Two pages share the pane: the left one's share, each at least PAGE_MIN wide. */
export const SHARE: Measure = {
  key: 'eien.split',
  axis: 'x',
  even: 0.5,
  read: (text) => readValue(text, 0.5, (value) => value > 0 && value < 1),
  shown(value, room) {
    if (!(room >= 2 * PAGE_MIN) || !finite(value)) return 0.5;
    return clamp(value, PAGE_MIN / room, 1 - PAGE_MIN / room);
  },
  moved(value, room, by) {
    if (!(room >= 2 * PAGE_MIN) || !finite(by)) return SHARE.shown(value, room);
    return SHARE.shown(SHARE.shown(value, room) + by / room, room);
  },
};

/** The companion's width beside the page: at least COMPANION.least, the page at least COMPANION.page. */
const width = (value: number, room: number) =>
  clamp(value, COMPANION.least, Math.max(COMPANION.least, room - COMPANION.page));

/** Room for the page and the companion each at its least; short of it (Two pages when narrow), they halve it. */
const besideFits = (room: number) => room >= COMPANION.least + COMPANION.page;

export const BESIDE: Measure = {
  key: 'eien.companion',
  axis: 'x',
  even: COMPANION.width,
  read: (text) => readValue(text, COMPANION.width, (value) => value >= COMPANION.least),
  shown: (value, room) => (besideFits(room) ? 1 - width(value, room) / room : 0.5),
  // Right is narrower: the companion gives the page what the divider moves over.
  moved: (value, room, by) =>
    finite(by) && besideFits(room) ? width(width(value, room) - by, room) : value,
};

/** Under the page: the companion's share of the height. */
export const UNDER_PAGE: Measure = {
  key: 'eien.companion-under',
  axis: 'y',
  even: UNDER.even,
  read: (text) =>
    readValue(text, UNDER.even, (value) => value >= UNDER.least && value <= UNDER.most),
  shown: (value) => 1 - clamp(value, UNDER.least, UNDER.most),
  moved: (value, room, by) =>
    finite(by) && room > 0 ? clamp(value - by / room, UNDER.least, UNDER.most) : value,
};
