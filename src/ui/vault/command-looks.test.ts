// How a book's commands look (#40): the bookmark pressed on a bookmarked page,
// its tooltip saying what a press does then (Phase 4b).

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/config';
import { commandLooks } from './command-looks';
import type { Side } from './pages';

const looks = commandLooks({
  panes: {} as never,
  versions: {} as never,
  settings: { values: DEFAULT_SETTINGS } as never,
  layout: () => 'band',
  strip: () => false,
  lookOpen: () => false,
} as never);

/** A page holding a book, bookmarked or not. */
const book = (bookmarked: boolean) =>
  ({ kind: 'epub', go: () => {}, marks: { bookmarks: { on: bookmarked } } }) as unknown as Side;

describe('a book’s bookmark tool', () => {
  it('is pressed on a bookmarked page, its tooltip saying a press takes it off', () => {
    expect(looks('bookmark', book(true))).toEqual({
      pressed: true,
      tip: 'Take the bookmark off',
    });
    expect(looks('bookmark', book(false))).toEqual({ pressed: false, tip: undefined });
  });

  it('is set aside with a note in front', () => {
    expect(looks('bookmark', { kind: 'note' } as unknown as Side)).toEqual({ aside: true });
  });
});

describe('the panes’ tools with three chosen and two shown (#68)', () => {
  const crowdedLooks = (crowded: boolean) =>
    commandLooks({
      panes: { crowded, two: crowded, aside: false, isShut: () => crowded },
      settings: { values: DEFAULT_SETTINGS } as never,
      layout: () => 'band',
      strip: () => false,
      lookOpen: () => false,
    } as never);
  const note = { kind: 'note' } as unknown as Side;

  it('say there’s no room for three, the choice still Three to switch from', () => {
    const looks = crowdedLooks(true);
    expect(looks('panes', note)).toEqual({
      icon: 'panes3',
      pressed: false,
      tip: 'Three panes, two here for the room · switch to two',
    });
    expect(looks('pane.list', note)).toEqual({
      disabled: true,
      tip: 'No room for three panes here: the sidebar lists the notes',
    });
  });

  it('offer no way back for the list stepped aside for a split, with no room for it', () => {
    const looks = commandLooks({
      panes: { crowded: true, two: true, aside: true, isShut: () => true },
      settings: { values: DEFAULT_SETTINGS } as never,
      layout: () => 'band',
      strip: () => false,
      lookOpen: () => false,
    } as never);
    expect(looks('pane.list', note)).toMatchObject({ disabled: true });
  });

  it('are three panes’ with the room for them', () => {
    const looks = crowdedLooks(false);
    expect(looks('panes', note)).toMatchObject({ icon: 'panes3', pressed: false });
    expect(looks('pane.list', note)).toMatchObject({ pressed: true });
  });
});
