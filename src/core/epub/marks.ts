// A book's marks together (#40, Phase 5b): its bookmarks (./bookmarks.ts)
// and its highlights (./highlights.ts) in the book's order, as Marks lists
// them and `]` and `[` walk them: by their chapters' places in the reading
// order, then where in each they begin, a bookmark first where both begin
// at one word. One whose chapter isn't in the book is kept in the file and
// never shown.

import type { Bookmark } from './bookmarks';
import type { Highlight } from './highlights';
import { sightEnd } from './place';

/** A mark of either kind, where it stands in the book. */
export type Mark = (
  | { readonly kind: 'bookmark'; readonly mark: Bookmark }
  | { readonly kind: 'highlight'; readonly mark: Highlight }
) & {
  /** Its chapter's place in the reading order. */
  readonly spine: number;
  /** Where in it the mark begins: a bookmark's page's first word, a highlight's first. */
  readonly offset: number;
};

/** Which kind comes first where two begin at one word. */
const KIND_ORDER: Readonly<Record<Mark['kind'], number>> = { bookmark: 0, highlight: 1 };

/** Every mark of the book's that's in `spine` (its files' paths), in the book's order. */
export function marksInOrder(
  bookmarks: readonly Bookmark[],
  highlights: readonly Highlight[],
  spine: readonly string[],
): Mark[] {
  const at = new Map(spine.map((path, i) => [path, i]));
  const placed = (chapter: string) => at.get(chapter);
  const marks: Mark[] = [];
  for (const mark of bookmarks) {
    const index = placed(mark.chapter);
    if (index !== undefined)
      marks.push({ kind: 'bookmark', mark, spine: index, offset: mark.offset });
  }
  for (const mark of highlights) {
    const index = placed(mark.chapter);
    if (index !== undefined)
      marks.push({ kind: 'highlight', mark, spine: index, offset: mark.from });
  }
  return marks.sort(
    (a, b) => a.spine - b.spine || a.offset - b.offset || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
}

/**
 * Where the reader is: the chapter drawn, and the words in sight, `from` up
 * to (not at) `to`; before the chapter's first word, `BEFORE_WORDS`.
 */
export interface InSight {
  readonly spine: number;
  readonly from: number;
  readonly to: number;
}

/** The words in sight on a page before a chapter's first word (Eien's title page), or none measured. */
export const BEFORE_WORDS = { from: -1, to: 0 } as const;

/** Where a thing stands in the book: its chapter's place in the reading order, and an offset in its words. */
export interface Placed {
  readonly spine: number;
  readonly offset: number;
}

/** Where a walk came to: the thing, its place among them all, and whether it went round the book. */
export interface Walk<T> {
  readonly to: T;
  readonly index: number;
  readonly round: boolean;
}

/**
 * Forward (`way` 1): the first of `items` past the words in sight; back
 * (-1): the last before them. Past either end of the book, round to the
 * other. Null for none. `items` in the book's order, each placed by
 * `placeOf`: the walk `]` and `[` take over the marks, and Find's next and
 * previous over its matches.
 */
export function walkPlaces<T>(
  items: readonly T[],
  placeOf: (item: T) => Placed,
  sight: InSight,
  way: 1 | -1,
): Walk<T> | null {
  if (items.length === 0) return null;
  const before = (item: T, spine: number, offset: number) => {
    const place = placeOf(item);
    return place.spine < spine || (place.spine === spine && place.offset < offset);
  };
  const at = (index: number, round: boolean): Walk<T> => ({
    to: items[index] as T,
    index,
    round,
  });
  if (way > 0) {
    // At or past the words after those in sight.
    const end = sightEnd(sight.from, sight.to);
    const index = items.findIndex((item) => !before(item, sight.spine, end));
    return index >= 0 ? at(index, false) : at(0, true);
  }
  const index = items.findLastIndex((item) => before(item, sight.spine, sight.from));
  return index >= 0 ? at(index, false) : at(items.length - 1, true);
}

/** `]` (`way` 1) or `[` (-1) over the book's marks, in its order (`marksInOrder`). */
export const walkMarks = (marks: readonly Mark[], sight: InSight, way: 1 | -1): Walk<Mark> | null =>
  walkPlaces(marks, (mark) => mark, sight, way);
