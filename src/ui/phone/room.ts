// How the window uses its room (spec §10, the Wide screen setting): a
// phone's is one pane at a time; wider, the phone's build does as the writer
// chose (the desktop's panes, one at a time still, the pane you came from
// beside the one you're in, or two pages with the notes sliding over them),
// and the desktop is always panes. The rules alone, for ./phone-stack.ts and
// the settings screen.

import { offeredOn, type SettingValues, settingOf } from '../../core/config';

export type PhonePane = 'sidebar' | 'list' | 'page';

/** The panes in the order a phone goes forward through them. */
export const PHONE_ORDER: readonly PhonePane[] = ['sidebar', 'list', 'page'];

export type Room = SettingValues['appearance.room'];

/**
 * Narrower than any desktop window (app/electron/window.ts: 640, less a Windows frame's 16): no
 * room for the desktop's panes.
 */
export const NARROW = '(max-width: 599.98px)';

/**
 * A phone held upright (440px at most), or a foldable's cover screen: one pane at a time, whatever
 * is chosen. A foldable opened is wider (a Galaxy Z Fold 5's inner screen upright, about 590px).
 */
export const UPRIGHT_PHONE = '(max-width: 519.98px)';

/** What the window's width has room for: the desktop's panes (600px), two panes the phone's way (520px). */
export interface Width {
  readonly panes: boolean;
  readonly two: boolean;
}

/** The window's width now. */
export const widthNow = (): Width => ({
  panes: !matchMedia(NARROW).matches,
  two: !matchMedia(UPRIGHT_PHONE).matches,
});

const wide = settingOf('appearance.room');

/** Whether this system has Wide screen: the phone's build. */
const phoneBuild = (platform: string): boolean => wide !== undefined && offeredOn(wide, platform);

/**
 * The room now. The desktop: its panes, or one at a time under 600px. The phone's build: one at a
 * time held upright; wider, the choice, but Panes only with the desktop's room for them.
 */
export function roomOf(width: Width, platform: string, values: SettingValues): Room {
  if (!phoneBuild(platform)) return width.panes ? 'panes' : 'one';
  const chosen = values['appearance.room'];
  if (!width.two || (chosen === 'panes' && !width.panes)) return 'one';
  return chosen;
}

/**
 * Whether a page beside closes, the room now having one page: on the phone's build (folded,
 * turned, or Wide screen set). A desktop window zoomed narrow keeps its split for when it widens.
 */
export const closesBeside = (room: Room, platform: string): boolean =>
  !twoPages(room) && phoneBuild(platform);

/** The phone's way, one pane or a step at a time, a bar back: every room but the desktop's panes. */
export const onePane = (room: Room): boolean => room !== 'panes';

/** Whether a second page may open (a split, or a facing page). */
export const twoPages = (room: Room): boolean => room === 'panes' || room === 'pages';

/**
 * Two pages: a note chosen while one page shows another opens beside it, so there are two;
 * with two, it opens on the page you're in.
 */
export const opensBeside = (
  room: Room,
  split: boolean,
  open: string | null,
  chosen: string,
): boolean => room === 'pages' && !split && open !== null && open !== chosen;

/**
 * Whether `pane` is in sight with `shown` the pane the writer is at. Side by
 * side keeps the pane before in sight too (the contents beside a folder's
 * notes, which stay beside the page); two pages keep the page under the
 * notes, which slide over it.
 */
export function inSight(room: Room, shown: PhonePane, pane: PhonePane): boolean {
  if (room === 'panes' || pane === shown) return true;
  if (room === 'side') return shown === 'page' ? pane === 'list' : pane !== 'page';
  return room === 'pages' && pane === 'page';
}

/** Where back goes: a pane before, while the contents are out of sight; none once they're in it. */
export function backTo(room: Room, shown: PhonePane): PhonePane | null {
  if (inSight(room, shown, 'sidebar')) return null;
  return PHONE_ORDER[PHONE_ORDER.indexOf(shown) - 1] ?? null;
}
