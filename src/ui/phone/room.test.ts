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
      'pages',
    ]);
    expect(roomOf(FOLD, 'darwin', choosing('side'))).toBe('one'); // a desktop window that narrow
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
