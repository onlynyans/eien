// Inline marks: bold, italic, underline, strikethrough, highlight. Each
// command toggles: on a marked selection it takes the mark off.

import { flanking } from '../markdown';
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

/** A word's letters, with the combining marks of Hindi, Thai or a decomposed "é" among them. */
const isWordChar = (char: string | undefined) =>
  char !== undefined && /[\p{L}\p{M}\p{N}_'’-]/u.test(char);

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

/**
 * `text` holds a mark of this kind: a "**" for bold, an odd run of "*" for
 * italic ("*" or "***"), the mark itself for the others.
 */
function containsMark(text: string, mark: InlineMark): boolean {
  const runs = text.match(/\*+/g) ?? [];
  if (mark.open === '*') return runs.some((run) => run.length % 2 === 1);
  if (mark.open === '**') return runs.some((run) => run.length >= 2);
  return text.includes(mark.open) || text.includes(mark.close);
}

/** `text` with every mark of this kind taken out. */
function withoutMarks(text: string, mark: InlineMark): string {
  if (mark.open === '*')
    return text.replace(/\*+/g, (run) => (run.length % 2 === 1 ? run.slice(1) : run));
  if (mark.open === '**')
    return text.replace(/\*+/g, (run) => (run.length >= 2 ? run.slice(2) : run));
  return text.split(mark.open).join('').split(mark.close).join('');
}

/** The span carries `mark` inside it, at its two ends, and nowhere between ("*one*" selected whole). */
function holds(text: string, span: Selection, mark: InlineMark): boolean {
  const inner = text.slice(span.from, span.to);
  if (inner.length < mark.open.length + mark.close.length + 1) return false;
  if (!inner.startsWith(mark.open) || !inner.endsWith(mark.close)) return false;
  if (containsMark(inner.slice(mark.open.length, inner.length - mark.close.length), mark))
    return false;
  if (mark.open === '*') {
    // "*x*" or "***x***", never the stars of plain bold
    const lead = runAfter(inner, 0, '*');
    return lead % 2 === 1;
  }
  return true;
}

/**
 * The part of `span` the parser can read `mark` around: its ends moved in
 * past punctuation and spaces that would leave the marks showing ("a«, b»"
 * gives "a, **b**", not "a**, b**"). <u> is a tag, read anywhere. Null when
 * there's no word in it to move to.
 */
function markable(text: string, span: Selection, mark: InlineMark): Selection | null {
  if (mark.open.startsWith('<')) return span;
  // The mark's own characters are never moved past: a span holding its marks is unmarked whole.
  const own = (char: string | undefined) => char !== undefined && mark.open.includes(char);
  let { from, to } = span;
  while (from < to && !own(text[from]) && !flanking(text[from - 1] ?? '', text[from] ?? '').open)
    from++;
  while (to > from && !own(text[to - 1]) && !flanking(text[to - 1] ?? '', text[to] ?? '').close)
    to--;
  return from < to ? { from, to } : null;
}

const isMarked = (text: string, span: Selection, mark: InlineMark) => {
  const { from, to } = markable(text, span, mark) ?? span;
  return wrappedIn(text, from, to, mark) || holds(text, { from, to }, mark);
};

/** Toggle `mark` on one span of a single line. */
function toggleSpan(
  text: string,
  span: Selection,
  mark: InlineMark,
): { changes: Change[]; selection: Selection } {
  const { from, to } = markable(text, span, mark) ?? span;
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
    if (!wouldBreak && !containsMark(bare, mark)) {
      return {
        changes: [{ from, to, insert: bare }],
        selection: { from, to: from + bare.length },
      };
    }
  }
  // Partly marked already ("**a** and **b**"): mark the whole, as a word
  // processor's Bold does, rather than leave stray marks.
  if (containsMark(inner, mark)) {
    const bare = withoutMarks(inner, mark);
    return {
      changes: [{ from, to, insert: mark.open + bare + mark.close }],
      selection: { from: from + mark.open.length, to: from + mark.open.length + bare.length },
    };
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

  const lines = lineSpans(text, selection);
  if (lines.length === 1) return toggleSpan(text, lines[0] as Selection, mark);

  // Several lines: all marked already → unmark all; otherwise mark the unmarked ones.
  // A line whose part holds no word ("(" before the selection's end) is left as it is.
  const spans = lines.filter((span) => markable(text, span, mark));
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

/**
 * A line's own marks at its start: a quote's ">", then a heading's "#", or a
 * list's "-" or "1." with a task's "[ ]". Marks go inside these, never
 * around them: "- **one**", not "**- one**".
 */
const LINE_MARKS =
  /^[ \t]*(?:>[ \t]?)*[ \t]*(?:#{1,6}[ \t]+|(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?)?/;

/** The non-blank stretch of each line inside `selection`, ends trimmed of spaces and line marks. */
function lineSpans(text: string, selection: Selection): Selection[] {
  const spans: Selection[] = [];
  let lineStart = selection.from;
  while (lineStart <= selection.to) {
    const newline = text.indexOf('\n', lineStart);
    const lineEnd = Math.min(newline === -1 ? text.length : newline, selection.to);
    let from = lineStart;
    let to = lineEnd;
    const realStart = text.lastIndexOf('\n', lineStart - 1) + 1;
    const marks =
      LINE_MARKS.exec(text.slice(realStart, newline === -1 ? text.length : newline))?.[0] ?? '';
    from = Math.max(from, realStart + marks.length);
    while (from < to && /\s/.test(text[from] ?? '')) from++;
    while (to > from && /\s/.test(text[to - 1] ?? '')) to--;
    if (from < to) spans.push({ from, to });
    if (newline === -1 || newline >= selection.to) break;
    lineStart = newline + 1;
  }
  if (spans.length === 0) spans.push({ from: selection.from, to: selection.to });
  return spans;
}
