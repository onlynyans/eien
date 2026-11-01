// The room a window uses (spec §10, Wide screen): which panes are in sight in
// each, and where back goes.

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type SettingValues } from '../../core/config';
import {
  backTo,
  closesBeside,
  inSight,
  onePane,
  opensBeside,
  PHONE_ORDER,
  type PhonePane,
  type Room,
  roomOf,
  twoPages,
} from './room';

const ROOMS: readonly Room[] = ['panes', 'one', 'side', 'pages'];
const choosing = (room: Room): SettingValues => ({ ...DEFAULT_SETTINGS, 'appearance.room': room });
const sight = (room: Room, shown: PhonePane) =>
  PHONE_ORDER.filter((pane) => inSight(room, shown, pane));

/**
 * Screens (./room.ts): a phone upright (412px, 9:20); the same at 50% zoom (824px, still 9:20);
 * a Galaxy Z Fold 5 opened at its own size (about 518px, 5:6) or a tablet upright; a window that
 * small beside another, or zoomed in that far; a tablet, or a fold sideways.
 */
const PHONE = { panes: false, tall: true, cramped: false };
const PHONE_ZOOMED_OUT = { panes: true, tall: true, cramped: false };
const FOLD = { panes: false, tall: false, cramped: false };
const CRAMPED = { panes: false, tall: false, cramped: true };
const WIDE = { panes: true, tall: false, cramped: false };
const PHONES = ['android', 'ios', 'web'];
const DESKTOPS = ['darwin', 'win32', 'linux'];

describe('the room', () => {
  it('is one pane at a time on a tall screen (a phone upright), whatever is chosen, at any zoom', () => {
    for (const room of ROOMS) {
      for (const phone of PHONES) {
        expect(roomOf(PHONE, phone, choosing(room))).toBe('one');
        expect(roomOf(PHONE_ZOOMED_OUT, phone, choosing(room))).toBe('one');
      }
      expect(roomOf(PHONE, 'darwin', choosing(room))).toBe('one');
    }
  });

  it('is one pane at a time on a cramped screen, whatever its shape', () => {
    for (const room of ROOMS) expect(roomOf(CRAMPED, 'android', choosing(room))).toBe('one');
  });

  it('is the writer’s choice on a wider phone’s screen, and always panes on a wide desktop', () => {
    for (const room of ROOMS) {
      for (const phone of PHONES) expect(roomOf(WIDE, phone, choosing(room))).toBe(room);
      for (const desktop of DESKTOPS) expect(roomOf(WIDE, desktop, choosing(room))).toBe('panes');
    }
  });

  it('on a foldable opened, short of the desktop’s 600px, is still the choice: Panes too (#68)', () => {
    for (const room of ROOMS) expect(roomOf(FOLD, 'android', choosing(room))).toBe(room);
    // A desktop window that narrow goes by its width alone.
    expect(roomOf(FOLD, 'darwin', choosing('side'))).toBe('one');
    expect(roomOf(PHONE_ZOOMED_OUT, 'darwin', choosing('one'))).toBe('panes');
  });

  it('is today’s panes until the writer chooses', () => {
    expect(roomOf(WIDE, 'android', DEFAULT_SETTINGS)).toBe('panes');
  });

  it('goes the phone’s way in every room but panes, and opens two pages only with panes or two pages', () => {
    expect(ROOMS.filter(onePane)).toEqual(['one', 'side', 'pages']);
    expect(ROOMS.filter(twoPages)).toEqual(['panes', 'pages']);
  });
});

describe('a page beside', () => {
  it('closes in a room of one page on the phone’s build, and never on the desktop', () => {
    expect(ROOMS.filter((room) => closesBeside(room, 'android'))).toEqual(['one', 'side']);
    for (const room of ROOMS) expect(closesBeside(room, 'darwin')).toBe(false);
  });
});

describe('a note chosen', () => {
  it('with two pages, opens beside the one page open on another note, so there are two', () => {
    expect(opensBeside('pages', false, 'Tear.md', 'Mend.md')).toBe(true);
  });

  it('opens on the page you’re in with two open, with none open yet, or the same note again', () => {
    expect(opensBeside('pages', true, 'Tear.md', 'Mend.md')).toBe(false);
    expect(opensBeside('pages', false, null, 'Mend.md')).toBe(false);
    expect(opensBeside('pages', false, 'Tear.md', 'Tear.md')).toBe(false);
  });

  it('in every other room, on the page you’re in', () => {
    for (const room of ['panes', 'one', 'side'] as const)
      expect(opensBeside(room, false, 'Tear.md', 'Mend.md')).toBe(false);
  });
});

describe('what’s in sight', () => {
  it('with panes, all three', () => {
    for (const shown of PHONE_ORDER) expect(sight('panes', shown)).toEqual(PHONE_ORDER);
  });

  it('one at a time, the pane shown alone', () => {
    for (const shown of PHONE_ORDER) expect(sight('one', shown)).toEqual([shown]);
  });

  it('side by side, the pane you came from beside the one you’re in', () => {
    expect(sight('side', 'page')).toEqual(['list', 'page']);
    expect(sight('side', 'list')).toEqual(['sidebar', 'list']);
    expect(sight('side', 'sidebar')).toEqual(['sidebar', 'list']);
  });

  it('with two pages, the page always, the notes or contents over it', () => {
    expect(sight('pages', 'page')).toEqual(['page']);
    expect(sight('pages', 'list')).toEqual(['list', 'page']);
    expect(sight('pages', 'sidebar')).toEqual(['sidebar', 'page']);
  });
});

describe('back', () => {
  it('goes a pane back while the contents are out of sight, and nowhere once they’re in it', () => {
    expect(PHONE_ORDER.map((shown) => backTo('one', shown))).toEqual([null, 'sidebar', 'list']);
    expect(PHONE_ORDER.map((shown) => backTo('side', shown))).toEqual([null, null, 'list']);
    expect(PHONE_ORDER.map((shown) => backTo('pages', shown))).toEqual([null, 'sidebar', 'list']);
    expect(PHONE_ORDER.map((shown) => backTo('panes', shown))).toEqual([null, null, null]);
  });
});
