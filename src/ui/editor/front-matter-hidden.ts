// The front matter kept out of sight (spec §4, §9): in Live and Reading, the
// front matter a note's first seal adds when it holds that "id:" alone; and,
// with Hide tags and IDs on (backlog #45), the "tags:" and "id:" lines in
// every view. Out of sight, they're kept whole: the caret never rests in
// them, the writer's edits go round them, find passes over them and a copy
// leaves them out. Eien's own changes (a reload, a seal's id, a restore, the
// page's tags, the note's history) come through as they are.

import {
  type ChangeSet,
  type ChangeSpec,
  EditorSelection,
  EditorState,
  Facet,
  RangeSet,
  StateField,
  type Text,
  Transaction,
  type TransactionSpec,
} from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { NO_LINES, type TagAndIdLines, tagAndIdLines } from '../../core/note';
import { noteIdOf } from '../../core/versions';
import { hide, hideLines } from './hidden-ranges';
import { fromDoc } from './note-doc';
import { previewMode } from './preview-mode';

/** Hide tags and IDs (Settings → Writing → Editor): the front matter's tags: and id: lines out of sight. */
export const hideTagsAndIds = Facet.define<boolean, boolean>({
  combine: (values) => values[0] ?? false,
});

/** Front matter that is Eien's own and nothing else: the "id:" a note's first seal gave it. */
const ID_ONLY = /^---\nid:[ \t]*([A-Za-z0-9_-]{1,64})[ \t]*\n(?:---|\.\.\.)[ \t]*(?:\n|$)/;

function idOnly(text: string): TagAndIdLines {
  const match = ID_ONLY.exec(text);
  // As YAML reads it: "id: null" or "id: true" isn't an id, and stays in sight.
  if (!match || noteIdOf(match[0]) !== match[1]) return NO_LINES;
  const whole = [{ from: 0, to: match[0].length - (match[0].endsWith('\n') ? 1 : 0) }];
  return { hidden: whole, kept: whole };
}

/** Asked at every transaction: worked out once for each text and rule. */
const FOUND = new WeakMap<Text, { tags?: TagAndIdLines; id?: TagAndIdLines }>();

/** The front matter's lines out of sight in `state`, and the lines kept as they are with them. */
export function frontMatterLines(state: EditorState): TagAndIdLines {
  const rule = state.facet(hideTagsAndIds) ? 'tags' : state.facet(previewMode) ? 'id' : null;
  if (!rule) return NO_LINES;
  const found = FOUND.get(state.doc) ?? {};
  FOUND.set(state.doc, found);
  found[rule] ??= (rule === 'tags' ? tagAndIdLines : idOnly)(state.doc.sliceString(0, 65_536));
  return found[rule];
}

/**
 * A run of kept lines with the line breaks either side: no change of the
 * writer's reaches into it. The caret may rest at either end where a line
 * in sight meets it, never where the kept text itself starts or ends.
 */
interface Guard {
  readonly from: number;
  readonly to: number;
  readonly fromOk: boolean;
  readonly toOk: boolean;
}

function guards(state: EditorState): Guard[] {
  const length = state.doc.length;
  return frontMatterLines(state).kept.map((span) => ({
    from: Math.max(0, span.from - 1),
    to: Math.min(length, span.to + 1),
    fromOk: span.from > 0,
    toOk: span.to < length,
  }));
}

/**
 * Where `pos` may be: itself, or the nearest end of the kept lines it's in,
 * the next line first. A note that is only kept lines has the end of the
 * note, and what's typed there starts a line of its own (`newline`).
 */
function placed(all: readonly Guard[], pos: number): { pos: number; newline: boolean } {
  for (const g of all) {
    const inside =
      (pos > g.from && pos < g.to) || (pos === g.from && !g.fromOk) || (pos === g.to && !g.toOk);
    if (!inside) continue;
    if (g.toOk || g.fromOk) return { pos: g.toOk ? g.to : g.from, newline: false };
    return { pos: g.to, newline: true };
  }
  return { pos, newline: false };
}

/** Where the writing starts: the caret's place in a note just opened. */
export const writingStart = (state: EditorState): number => placed(guards(state), 0).pos;

/** Whether `from`–`to` touches a kept line, or the line break either side of one. */
const touchesKept = (state: EditorState, from: number, to: number): boolean =>
  frontMatterLines(state).kept.some((span) => from <= span.to && to >= span.from);

/** A find's test (SearchQuery's): a match in sight, not in the kept lines, which it can't change. */
export const shownMatch = (_match: string, state: EditorState, from: number, to: number): boolean =>
  !touchesKept(state, from, to);

/** `from`–`to` without what's guarded: the stretches of it a change may take. */
function outside(all: readonly Guard[], from: number, to: number): { from: number; to: number }[] {
  let pieces = [{ from, to }];
  for (const g of all) {
    pieces = pieces.flatMap((p) =>
      [
        { from: p.from, to: Math.min(p.to, g.from) },
        { from: Math.max(p.from, g.to), to: p.to },
      ].filter((q) => q.to > q.from),
    );
  }
  return pieces;
}

/**
 * The writer's change `tr`, made to go round the kept lines; null when it
 * doesn't reach them. A stretch taken out loses only what's in sight, what
 * replaces it going where the writing resumes (Select All and type keeps the
 * front matter); a stretch wholly inside goes, with what was to replace it
 * (a find's replace there); text put in a kept line goes after it.
 * `changes` is empty when nothing of it is left.
 */
function goneRound(tr: Transaction): (TransactionSpec & { changes: ChangeSet }) | null {
  const all = guards(tr.startState);
  if (all.length === 0) return null;
  const changes: ChangeSpec[] = [];
  let moved = false;
  /** Where the last change kept ends, in the text before: the caret goes there. */
  let caret = -1;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (fromA < toA) {
      const pieces = outside(all, fromA, toA);
      const same = pieces.length === 1 && pieces[0]?.from === fromA && pieces[0]?.to === toA;
      if (!same) moved = true;
      pieces.forEach((piece, i) => {
        const last = i === pieces.length - 1;
        changes.push({ ...piece, insert: last ? inserted : '' });
        if (last) caret = piece.to;
      });
      return;
    }
    const at = placed(all, fromA);
    if (at.pos !== fromA || at.newline) moved = true;
    changes.push({ from: at.pos, insert: at.newline ? `\n${inserted}` : inserted });
    caret = at.pos;
  });
  if (!moved) return null;
  const set = tr.startState.changes(changes);
  const selection = EditorSelection.cursor(set.mapPos(Math.max(0, caret), 1));
  return {
    changes: set,
    selection,
    effects: tr.effects,
    annotations: Transaction.userEvent.of(tr.annotation(Transaction.userEvent) ?? 'input'),
    scrollIntoView: tr.scrollIntoView,
  };
}

/** `selection` with every end out of the kept lines; null when none is in them. */
function keptOut(state: EditorState, selection: EditorSelection): EditorSelection | null {
  const all = guards(state);
  if (all.length === 0) return null;
  let moved = false;
  const ranges = selection.ranges.map((range) => {
    const anchor = placed(all, range.anchor).pos;
    const head = placed(all, range.head).pos;
    if (anchor === range.anchor && head === range.head) return range;
    moved = true;
    return EditorSelection.range(anchor, head);
  });
  return moved ? EditorSelection.create(ranges, selection.mainIndex) : null;
}

const keepLines = EditorState.transactionFilter.of((tr) => {
  // The writer's own: Eien's changes and the note's history come as they are.
  const writers =
    tr.docChanged &&
    tr.annotation(Transaction.userEvent) !== undefined &&
    tr.annotation(fromDoc) === undefined;
  const round = writers ? goneRound(tr) : null;
  if (round?.changes.empty) return [];
  if (round) {
    const state = tr.startState.update({ ...round, filter: false }).state;
    return { ...round, selection: keptOut(state, state.selection) ?? state.selection };
  }
  const selection = keptOut(tr.state, tr.newSelection);
  return selection ? [tr, { selection, sequential: true }] : tr;
});

/** The hidden lines' decorations: whole lines out of sight, in every view. */
const hiddenLines = StateField.define<DecorationSet>({
  create: (state) => decorations(state),
  update(value, tr) {
    const before = frontMatterLines(tr.startState);
    const after = frontMatterLines(tr.state);
    return before === after && !tr.docChanged ? value : decorations(tr.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function decorations(state: EditorState): DecorationSet {
  const { hidden } = frontMatterLines(state);
  return hidden.length === 0
    ? Decoration.none
    : Decoration.set(hidden.map((span) => hideLines.range(span.from, span.to)));
}

/** A copy leaves the hidden lines out: pasted elsewhere, they'd be another note's id and tags. */
const copyWithout = EditorView.clipboardOutputFilter.of((text, state) => {
  const { hidden } = frontMatterLines(state);
  const chosen = state.selection.ranges.filter((range) => !range.empty);
  if (hidden.length === 0 || !chosen.some((r) => touchesKept(state, r.from, r.to))) return text;
  const length = state.doc.length;
  const out = hidden.map((span) =>
    span.to < length
      ? { from: span.from, to: span.to + 1 }
      : { from: Math.max(0, span.from - 1), to: span.to },
  );
  return chosen
    .map((range) => {
      let at = range.from;
      let copied = '';
      for (const gone of out) {
        if (gone.to <= at || gone.from >= range.to) continue;
        copied += state.sliceDoc(at, Math.max(at, gone.from));
        at = Math.max(at, gone.to);
      }
      return copied + state.sliceDoc(Math.min(at, range.to), range.to);
    })
    .join(state.lineBreak);
});

/** The front matter kept out of sight, and whole: in the editor in every view. */
export const frontMatterHidden = [
  hiddenLines,
  keepLines,
  copyWithout,
  EditorView.atomicRanges.of((view) =>
    RangeSet.of(guards(view.state).map((g) => hide.range(g.from, g.to))),
  ),
];
