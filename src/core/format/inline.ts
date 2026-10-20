// Inline marks: bold, italic, underline, strikethrough, highlight. Each
// command toggles: on a marked selection it takes the mark off.

import type { Change, Edit, Selection } from './edit';

export interface InlineMark {
  readonly open: string;
  readonly close: string;
}

export const BOLD: InlineMark = { open: '**', close: '**' };
export const ITALIC: InlineMark = { open: '*', close: '*' };
export const STRIKE: InlineMark = { open: '~~', close: '~~' };
export const HIGHLIGHT: InlineMark = { open: '==', close: '==' };
export const UNDERLINE: InlineMark = { open: '<u>', close: '</u>' };

const isWordChar = (char: string | undefined) =>
  char !== undefined && /[\p{L}\p{N}_'’-]/u.test(char);

/** The word around `pos`, or null when `pos` isn't in or touching one. */
function wordAt(text: string, pos: number): Selection | null {
  let from = pos;
  let to = pos;
  while (from > 0 && isWordChar(text[from - 1])) from--;
  while (to < text.length && isWordChar(text[to])) to++;
  return from < to ? { from, to } : null;
}

/** How many times `char` repeats ending just before `pos` / starting at `pos`. */
const runBefore = (text: string, pos: number, char: string) => {
  let n = 0;
  while (pos - n - 1 >= 0 && text[pos - n - 1] === char) n++;
  return n;
};
const runAfter = (text: string, pos: number, char: string) => {
  let n = 0;
  while (text[pos + n] === char) n++;
  return n;
};

/**
 * Is the span [from, to] already wrapped in `mark` (its marks just outside)?
 * The "*" of italic and the "**" of bold share a character: italic is on when
 * an odd run of stars surrounds the span (* or ***), bold when two or more do.
 */
function wrappedIn(text: string, from: number, to: number, mark: InlineMark): boolean {
  if (mark.open === '*' || mark.open === '**') {
    const before = runBefore(text, from, '*');
    const after = runAfter(text, to, '*');
    return mark.open === '*' ? before % 2 === 1 && after % 2 === 1 : before >= 2 && after >= 2;
  }
  return (
    text.slice(from - mark.open.length, from) === mark.open &&
    text.slice(to, to + mark.close.length) === mark.close
  );
}

/** The span carries `mark` inside it, at its two ends ("*one*" selected whole). */
function holds(text: string, span: Selection, mark: InlineMark): boolean {
  const inner = text.slice(span.from, span.to);
  if (inner.length < mark.open.length + mark.close.length + 1) return false;
  if (!inner.startsWith(mark.open) || !inner.endsWith(mark.close)) return false;
  if (mark.open === '*') {
    // "*x*" or "***x***", never the stars of plain bold
    const lead = runAfter(inner, 0, '*');
    return lead % 2 === 1;
  }
  return true;
}

const isMarked = (text: string, span: Selection, mark: InlineMark) =>
  wrappedIn(text, span.from, span.to, mark) || holds(text, span, mark);

/** Toggle `mark` on one span of a single line. */
function toggleSpan(
  text: string,
  span: Selection,
  mark: InlineMark,
): { changes: Change[]; selection: Selection } {
  const { from, to } = span;
  const inner = text.slice(from, to);
  if (wrappedIn(text, from, to, mark)) {
    return {
      changes: [
        { from: from - mark.open.length, to: from, insert: '' },
        { from: to, to: to + mark.close.length, insert: '' },
      ],
      selection: { from: from - mark.open.length, to: to - mark.open.length },
    };
  }
  // The selection took its marks in with it: take them off.
  if (
    inner.length >= mark.open.length + mark.close.length &&
    inner.startsWith(mark.open) &&
    inner.endsWith(mark.close)
  ) {
    const bare = inner.slice(mark.open.length, inner.length - mark.close.length);
    const wouldBreak =
      (mark.open === '*' && bare.startsWith('*') && !bare.startsWith('**')) || bare.length === 0;
    if (!wouldBreak) {
      return {
        changes: [{ from, to, insert: bare }],
        selection: { from, to: from + bare.length },
      };
    }
  }
  return {
    changes: [
      { from, to: from, insert: mark.open },
      { from: to, to, insert: mark.close },
    ],
    selection: { from: from + mark.open.length, to: to + mark.open.length },
  };
}

/**
 * Toggle `mark` over `selection`. An empty selection takes the word it's in,
 * or, outside a word, puts the two marks in with the caret between them. A
 * selection over several lines marks each line's text on its own, since a
 * mark can't run across lines.
 */
export function toggleInline(text: string, selection: Selection, mark: InlineMark): Edit {
  if (selection.from === selection.to) {
    const word = wordAt(text, selection.from);
    if (!word) {
      const at = selection.from;
      if (
        text.slice(at - mark.open.length, at) === mark.open &&
        text.slice(at, at + mark.close.length) === mark.close
      ) {
        return {
          changes: [{ from: at - mark.open.length, to: at + mark.close.length, insert: '' }],
          selection: { from: at - mark.open.length, to: at - mark.open.length },
        };
      }
      return {
        changes: [{ from: at, to: at, insert: mark.open + mark.close }],
        selection: { from: at + mark.open.length, to: at + mark.open.length },
      };
    }
    const result = toggleSpan(text, word, mark);
    const offset = selection.from - word.from;
    const start = result.selection.from + offset;
    const caret = Math.min(start, result.selection.to);
    return { changes: result.changes, selection: { from: caret, to: caret } };
  }

  const spans = lineSpans(text, selection);
  if (spans.length === 1) return toggleSpan(text, spans[0] as Selection, mark);

  // Several lines: all marked already → unmark all; otherwise mark the unmarked ones.
  const allMarked = spans.every((span) => isMarked(text, span, mark));
  const changes: Change[] = [];
  for (const span of spans) {
    if (allMarked || !isMarked(text, span, mark))
      changes.push(...toggleSpan(text, span, mark).changes);
  }
  const growth = changes.reduce(
    (sum, change) => sum + change.insert.length - (change.to - change.from),
    0,
  );
  return { changes, selection: { from: selection.from, to: selection.to + growth } };
}

/** The non-blank stretch of each line inside `selection`, ends trimmed of spaces. */
function lineSpans(text: string, selection: Selection): Selection[] {
  const spans: Selection[] = [];
  let lineStart = selection.from;
  while (lineStart <= selection.to) {
    const newline = text.indexOf('\n', lineStart);
    const lineEnd = Math.min(newline === -1 ? text.length : newline, selection.to);
    let from = lineStart;
    let to = lineEnd;
    while (from < to && /\s/.test(text[from] ?? '')) from++;
    while (to > from && /\s/.test(text[to - 1] ?? '')) to--;
    if (from < to) spans.push({ from, to });
    if (newline === -1 || newline >= selection.to) break;
    lineStart = newline + 1;
  }
  if (spans.length === 0) spans.push({ from: selection.from, to: selection.to });
  return spans;
}
