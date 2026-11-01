// How the window uses its room (spec §10, the Wide screen setting): a phone
// held upright is one pane at a time; on a wider screen, the phone's build does as the writer
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
 * room for the desktop's panes. The desktop's rule alone; a phone's build goes by its screen.
 */
export const NARROW = '(max-width: 599.98px)';

/**
 * A phone held upright, or a foldable's cover screen: a screen taller than 7:12 (a phone's 9:16 to
 * 9:21, a Galaxy Z Fold 5's cover 904×2316), never a tablet upright (an 8.7" one is 800×1340, 3:5)
 * or a foldable opened (the Fold 5's 1812×2176, 5:6). The screen's shape, which neither Interface
 * zoom nor the system's own screen zoom changes, nor the keyboard coming up (it shrinks the
 * window, not the screen). Upright too: iOS keeps an iPhone's screen upright when it's turned.
 */
export const TALL = '(max-device-aspect-ratio: 7/12) and (orientation: portrait)';

/**
 * Narrower than a phone held upright (440px at most), whatever the screen's shape: zoomed in that
 * far, or a window that small beside another, there's nothing to keep beside the pane you're in.
 */
export const CRAMPED = '(max-width: 439.98px)';

/** The queries a room changes at, each listened to by what follows the room. */
export const ROOM_QUERIES: readonly string[] = [NARROW, TALL, CRAMPED];

/** What the screen has room for: the desktop's panes (600px); one pane only, tall or cramped. */
export interface Screen {
  readonly panes: boolean;
  readonly tall: boolean;
  readonly cramped: boolean;
}

/** The screen now. */
export const screenNow = (): Screen => ({
  panes: !matchMedia(NARROW).matches,
  tall: matchMedia(TALL).matches,
  cramped: matchMedia(CRAMPED).matches,
});

const wide = settingOf('appearance.room');

/** Whether this system has Wide screen: the phone's build. */
export const phoneBuild = (platform: string): boolean =>
  wide !== undefined && offeredOn(wide, platform);

/**
 * The room now. The desktop: its panes, or one at a time under 600px. The phone's build: one at a
 * time on a tall screen or a cramped one; else the choice, Panes at any width (the panes showing
 * what fits, ../shell/pane-state.ts).
 */
export function roomOf(screen: Screen, platform: string, values: SettingValues): Room {
  if (!phoneBuild(platform)) return screen.panes ? 'panes' : 'one';
  return screen.tall || screen.cramped ? 'one' : values['appearance.room'];
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
