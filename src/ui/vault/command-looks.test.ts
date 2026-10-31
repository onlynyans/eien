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
  ({ kind: 'epub', go: () => {}, bookmarked }) as unknown as Side;

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
