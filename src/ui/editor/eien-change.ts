// Eien's own changes to a note's text — a restore, the id a seal adds — as
// against the writer's (spec §4: today's words are the writer's). A change
// of Eien's carries a mark, and so do its undo and redo: ⌘Z after a restore
// takes back no one's writing.

import { invertedEffects, isolateHistory } from '@codemirror/commands';
import { type Annotation, StateEffect, Transaction } from '@codemirror/state';

/** On a change that is Eien's own, and on its undo and redo. */
const byEien = StateEffect.define<null>();

/** An undo or redo of Eien's change is Eien's too. */
export const eienUndo = invertedEffects.of((tr) =>
  tr.effects.some((effect) => effect.is(byEien)) ? [byEien.of(null)] : [],
);

/** How Eien's change goes: marked, and, if `undoable`, a step of its own in the history. */
export const eienChange = (
  undoable: boolean,
): { effects: StateEffect<null>; annotations: Annotation<unknown>[] } => ({
  effects: byEien.of(null),
  // Its own step: ⌘Z never takes back the writer's typing and Eien's change together.
  annotations: undoable ? [isolateHistory.of('full')] : [Transaction.addToHistory.of(false)],
});

/** Of `tr`'s effects, the mark of Eien's change, carried to where the change goes next (./note-doc.ts). */
export const eienEffects = (tr: Transaction): StateEffect<null>[] =>
  tr.effects.filter((effect): effect is StateEffect<null> => effect.is(byEien));

/** Whether `tr` is the writer's: typed, cut, pasted, formatted, undone — not Eien's. */
export const writtenBy = (tr: Transaction): boolean =>
  tr.docChanged &&
  tr.annotation(Transaction.userEvent) !== undefined &&
  !tr.effects.some((effect) => effect.is(byEien));
