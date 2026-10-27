// The room a window uses (spec §10, Wide screen): which panes are in sight in
// each, and where back goes.

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type SettingValues } from '../../core/config';
import {
  backTo,
  closesBeside,
  inSight,
  onePane,
  PHONE_ORDER,
  type PhonePane,
  type Room,
  roomOf,
} from './room';

const ROOMS: readonly Room[] = ['panes', 'one', 'side'];
const choosing = (room: Room): SettingValues => ({ ...DEFAULT_SETTINGS, 'appearance.room': room });
const sight = (room: Room, shown: PhonePane) =>
  PHONE_ORDER.filter((pane) => inSight(room, shown, pane));

/** An upright phone; a foldable opened upright (a Galaxy Z Fold 5, about 590px); a tablet, or a fold sideways. */
const PHONE = { panes: false, two: false };
const FOLD = { panes: false, two: true };
const WIDE = { panes: true, two: true };

describe('the room', () => {
  it('is one pane at a time on a phone held upright, whatever is chosen, on any system', () => {
    for (const room of ROOMS) {
      expect(roomOf(PHONE, 'android', choosing(room))).toBe('one');
      expect(roomOf(PHONE, 'darwin', choosing(room))).toBe('one');
    }
  });

  it('is the writer’s choice on a wider phone’s screen, and always panes on a wide desktop', () => {
    for (const room of ROOMS) {
      for (const phone of ['android', 'ios', 'web'])
        expect(roomOf(WIDE, phone, choosing(room))).toBe(room);
      for (const desktop of ['darwin', 'win32', 'linux'])
        expect(roomOf(WIDE, desktop, choosing(room))).toBe('panes');
    }
  });

  it('on a foldable opened upright, is any room but the desktop’s panes, which need 600px', () => {
    expect(ROOMS.map((room) => roomOf(FOLD, 'android', choosing(room)))).toEqual([
      'one',
      'one',
      'side',
    ]);
    expect(roomOf(FOLD, 'darwin', choosing('side'))).toBe('one'); // a desktop window that narrow
  });

  it('is today’s panes until the writer chooses', () => {
    expect(roomOf(WIDE, 'android', DEFAULT_SETTINGS)).toBe('panes');
  });

  it('goes the phone’s way, one page, in every room but panes', () => {
    expect(ROOMS.filter(onePane)).toEqual(['one', 'side']);
  });
});

describe('a page beside', () => {
  it('closes in a room of one page on the phone’s build, and never on the desktop', () => {
    expect(ROOMS.filter((room) => closesBeside(room, 'android'))).toEqual(['one', 'side']);
    for (const room of ROOMS) expect(closesBeside(room, 'darwin')).toBe(false);
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
});

describe('back', () => {
  it('goes a pane back while the contents are out of sight, and nowhere once they’re in it', () => {
    expect(PHONE_ORDER.map((shown) => backTo('one', shown))).toEqual([null, 'sidebar', 'list']);
    expect(PHONE_ORDER.map((shown) => backTo('side', shown))).toEqual([null, null, 'list']);
    expect(PHONE_ORDER.map((shown) => backTo('panes', shown))).toEqual([null, null, null]);
  });
});
