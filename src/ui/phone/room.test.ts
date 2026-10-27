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
  twoPages,
} from './room';

const ROOMS: readonly Room[] = ['panes', 'one', 'side', 'pages'];
const choosing = (room: Room): SettingValues => ({ ...DEFAULT_SETTINGS, 'appearance.room': room });
const sight = (room: Room, shown: PhonePane) =>
  PHONE_ORDER.filter((pane) => inSight(room, shown, pane));

describe('the room', () => {
  it('is one pane at a time under 600px, whatever is chosen, on any system', () => {
    for (const room of ROOMS) {
      expect(roomOf(true, 'android', choosing(room))).toBe('one');
      expect(roomOf(true, 'darwin', choosing(room))).toBe('one');
    }
  });

  it('is the writer’s choice on a wider phone’s screen, and always panes on the desktop', () => {
    for (const room of ROOMS) {
      for (const phone of ['android', 'ios', 'web'])
        expect(roomOf(false, phone, choosing(room))).toBe(room);
      for (const desktop of ['darwin', 'win32', 'linux'])
        expect(roomOf(false, desktop, choosing(room))).toBe('panes');
    }
  });

  it('is today’s panes until the writer chooses', () => {
    expect(roomOf(false, 'android', DEFAULT_SETTINGS)).toBe('panes');
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
