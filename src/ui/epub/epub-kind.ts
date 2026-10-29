// The EPUB's kind of page (#40; ../vault/page-side.ts PageKindOf): which
// files it shows, a page of it made, and its upkeep over its pages. A book's
// page follows its file when this window moves a folder above it (the
// organizer tells `moved`, and the next followMoves applies it), reads it
// again when it changes on disk, and lets it go when it's no longer there.

import { baseName, isInside } from '../../core/paths';
import { isEpubName } from '../../core/vault';
import { touches } from '../vault/disk-changes';
import type { PageKindOf, Side } from '../vault/page-side';
import { type EpubSide, type EpubSideOf, isEpub, makeEpubSide } from './epub-side';

export interface EpubKind extends PageKindOf {
  /** This window moved `from` (a book, or a folder holding one) to `to`. */
  moved(from: string, to: string): void;
}

const epubsOf = (sides: readonly Side[]): EpubSide[] => sides.filter(isEpub);

export function epubKind(of: EpubSideOf): EpubKind {
  /** Moves told since the pages last followed them, in order. */
  let moves: [string, string][] = [];
  /** Each page follows the moves told: before anything asks whether its book is still there. */
  const follow = (sides: readonly Side[]) => {
    const told = moves;
    moves = [];
    if (told.length === 0) return;
    for (const side of epubsOf(sides)) {
      let at = side.path;
      for (const [from, to] of told) {
        if (at && isInside(at, from)) at = to + at.slice(from.length);
      }
      if (at && at !== side.path) side.moved(at);
    }
  };
  return {
    kind: 'epub',
    holds: (path) => isEpubName(baseName(path)),
    make: (hooks, left) => makeEpubSide(of, hooks, left),
    moved: (from, to) => void moves.push([from, to]),
    flush: () => of.reading.idle(),
    diskChanged(changed, sides) {
      follow(sides);
      for (const side of epubsOf(sides)) {
        if (side.path && touches(side.path, changed) && of.sizeOf(side.path) !== null) {
          void side.reload().catch(() => {});
        }
      }
    },
    followMoves: follow,
    sync(sides) {
      follow(sides);
      // The vault read again: a book no longer there leaves its page.
      for (const side of epubsOf(sides)) {
        if (side.path && of.sizeOf(side.path) === null) side.clear();
      }
    },
    stop: () => {
      moves = [];
    },
  };
}
