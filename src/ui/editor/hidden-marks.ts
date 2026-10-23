// Live with "Show Markdown marks" off (spec §4): every mark stays out of
// sight, even on the caret's line, so the page reads like a word processor's.
// Editing never leaves half a mark: the caret steps over a hidden mark or a
// widget whole; Backspace and Delete take the letter beyond a mark, not the
// mark, and a pair of marks left with nothing between them goes too; at a
// line's start Backspace takes the line's own format off (a heading, a
// quote, a list item), as a word processor does. A table's cell edge stays
// put. Typing "**" still formats: the marks hide once the pair is whole.

import {
  type EditorState,
  type Extension,
  findClusterBreak,
  Prec,
  type TransactionSpec,
} from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { type HiddenMark, hiddenMarks, replacedRanges } from './hidden-ranges';
import { livePreview } from './live-preview';

type Change = { readonly from: number; readonly to: number };

/** Nothing to do, but the key is taken: Backspace at a cell's edge mustn't eat the pipe. */
const STAY: TransactionSpec = {};

/**
 * What Backspace (`forward` false) or Delete does with the marks hidden, or
 * null where there's no hidden mark in the way and the editor's own key does.
 */
export function deleteAcrossMarks(state: EditorState, forward: boolean): TransactionSpec | null {
  const { main } = state.selection;
  if (state.readOnly || state.selection.ranges.length > 1) return null;
  const line = state.doc.lineAt(main.head);
  const marks = hiddenMarks(state.field(livePreview, false), line.from, line.to);
  const userEvent = forward ? 'delete.forward' : 'delete.backward';
  const spec = (changes: Change[]): TransactionSpec => ({
    changes: [...changes].sort((a, b) => a.from - b.from),
    userEvent,
    scrollIntoView: true,
  });

  if (!main.empty) {
    // A chosen stretch that's all a format holds takes the format's marks with it.
    const pair = emptiedPair(marks, main.from, main.to);
    return pair ? spec([{ from: main.from, to: main.to }, ...pair]) : null;
  }

  // The marks right before the caret (Backspace) or after it (Delete), nearest first.
  const run: HiddenMark[] = [];
  let edge = main.head;
  for (;;) {
    const next = marks.find((m) => (forward ? m.from === edge : m.to === edge) && m.to > m.from);
    if (!next) break;
    run.push(next);
    edge = forward ? next.to : next.from;
  }
  if (run.some((m) => m.kind === 'pipe')) return STAY;
  if (!forward) {
    const lineMark = run.find((m) => m.kind === 'line');
    if (lineMark) return spec([{ from: lineMark.from, to: lineMark.to }]);
  }
  if (forward ? edge === line.to : edge === line.from) {
    if (run.length === 0) return null; // the editor's own: join the lines
    const at = forward ? line.to : line.from;
    if (forward ? at >= state.doc.length : at === 0) return STAY;
    return spec([forward ? { from: at, to: at + 1 } : { from: at - 1, to: at }]);
  }
  const offset = edge - line.from;
  const beyond = findClusterBreak(line.text, offset, forward) + line.from;
  const letter = forward ? { from: edge, to: beyond } : { from: beyond, to: edge };
  const pair = emptiedPair(marks, letter.from, letter.to);
  if (run.length === 0 && !pair) return null;
  return spec([letter, ...(pair ?? [])]);
}

/** The marks either side of [from, to) when that stretch is all they hold, or null. */
function emptiedPair(marks: readonly HiddenMark[], from: number, to: number): Change[] | null {
  const before = marks.find((m) => m.kind === 'inline' && m.to === from);
  const after = marks.find((m) => m.kind === 'inline' && m.from === to);
  return before && after ? [before, after] : null;
}

const run = (forward: boolean) => (view: EditorView) => {
  const spec = deleteAcrossMarks(view.state, forward);
  if (!spec) return false;
  if (spec !== STAY) view.dispatch(spec);
  return true;
};

/** Editing Live with its marks hidden: the atomic marks and widgets, and the two keys. */
export const hiddenMarkEditing: Extension = [
  EditorView.atomicRanges.of((view) => replacedRanges(view.state.field(livePreview, false))),
  Prec.highest(
    keymap.of([
      { key: 'Backspace', run: run(false) },
      { key: 'Delete', run: run(true) },
    ]),
  ),
];
