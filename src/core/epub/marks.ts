// A book's marks together (#40, Phase 5b): its bookmarks (./bookmarks.ts)
// and its highlights (./highlights.ts) in the book's order, as Marks lists
// them and `]` and `[` walk them: by their chapters' places in the reading
// order, then where in each they begin, a bookmark first where both begin
// at one word. One whose chapter isn't in the book is kept in the file and
// never shown.

import type { Bookmark } from './bookmarks';
import type { Highlight } from './highlights';

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

/** Where the reader is: the chapter drawn, and the words in sight, `from` up to (not at) `to`. */
export interface InSight {
  readonly spine: number;
  readonly from: number;
  readonly to: number;
}

/** The mark `]` or `[` goes to, its place among them all, and whether the walk went round the book. */
export interface MarkWalk {
  readonly mark: Mark;
  readonly index: number;
  readonly round: boolean;
}

/**
 * `]` (`way` 1): the first mark past the words in sight; `[` (-1): the last
 * before them. Past either end of the book, round to the other. Null for a
 * book with none. `marks` in the book's order (`marksInOrder`).
 */
export function walkMarks(marks: readonly Mark[], sight: InSight, way: 1 | -1): MarkWalk | null {
  if (marks.length === 0) return null;
  const before = (mark: Mark, spine: number, offset: number) =>
    mark.spine < spine || (mark.spine === spine && mark.offset < offset);
  if (way > 0) {
    // At or past the words after those in sight; a page of no words (a picture's) is its own word.
    const end = Math.max(sight.to, sight.from + 1);
    const index = marks.findIndex((mark) => !before(mark, sight.spine, end));
    return index >= 0
      ? { mark: marks[index] as Mark, index, round: false }
      : { mark: marks[0] as Mark, index: 0, round: true };
  }
  const index = marks.findLastIndex((mark) => before(mark, sight.spine, sight.from));
  const last = marks.length - 1;
  return index >= 0
    ? { mark: marks[index] as Mark, index, round: false }
    : { mark: marks[last] as Mark, index: last, round: true };
}
