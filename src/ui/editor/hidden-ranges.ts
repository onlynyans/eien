// What Live keeps out of sight, each kind its own decoration so the editing
// rules can tell them apart (./hidden-marks.ts): an inline mark, a line's own
// mark, a table's pipe, whole lines.

import type { Range } from '@codemirror/state';
import { Decoration, type DecorationSet } from '@codemirror/view';

/** An inline mark out of sight: "**", "[", "](address)", a tag. */
export const hide = Decoration.replace({});
/** A line's own mark out of sight: a heading's "#", a quote's ">", a task's "-". */
export const hideLineMark = Decoration.replace({});
/** A table's pipe out of sight: the edge between two cells. */
export const hidePipe = Decoration.replace({});
/** Whole lines out of sight: front matter kept out of sight (./front-matter-hidden.ts), a table's delimiter row. */
export const hideLines = Decoration.replace({ block: true });

/** A mark Live keeps out of sight: inline ("**"), a line's own ("## "), or a table's pipe. */
export interface HiddenMark {
  readonly from: number;
  readonly to: number;
  readonly kind: 'inline' | 'line' | 'pipe';
}

/** The marks hidden between `from` and `to` in Live's decorations `set`, in order. */
export function hiddenMarks(
  set: DecorationSet | undefined,
  from: number,
  to: number,
): HiddenMark[] {
  const found: HiddenMark[] = [];
  set?.between(from, to, (start, end, deco) => {
    const kind =
      deco === hide ? 'inline' : deco === hideLineMark ? 'line' : deco === hidePipe ? 'pipe' : null;
    if (kind) found.push({ from: start, to: end, kind });
  });
  return found;
}

/**
 * Everything Live draws in the marks' place, or hides, in its decorations
 * `set`: the marks, the widgets (an image, a checkbox), the hidden lines.
 * Every other decoration it makes is a look, with a class.
 */
export function replacedRanges(set: DecorationSet | undefined): DecorationSet {
  if (!set) return Decoration.none;
  // Asked for at every move of the caret: made once for each set of decorations.
  let replaced = REPLACED.get(set);
  if (!replaced) {
    const out: Range<Decoration>[] = [];
    set.between(0, Number.MAX_SAFE_INTEGER, (from, to, deco) => {
      if (to > from && !(deco.spec as { class?: string }).class) out.push(deco.range(from, to));
    });
    replaced = Decoration.set(out);
    REPLACED.set(set, replaced);
  }
  return replaced;
}

const REPLACED = new WeakMap<DecorationSet, DecorationSet>();
