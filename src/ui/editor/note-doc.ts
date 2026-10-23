// A note's text and its undo history, for every editor showing it (the
// split: one note on both sides is one document). CodeMirror can't share one
// state between two views, so the document keeps a state of its own, with
// the history and nothing else, and each view mirrors it: a view's change
// goes to the document, which sends it on to the other views; ⌘Z runs on the
// document's history and comes back to every view. Each change is the
// writer's (or Eien's) once, in the view it was made in; the others only
// echo it, so it's saved and counted once.

import { history, isolateHistory } from '@codemirror/commands';
import {
  Annotation,
  type ChangeSet,
  EditorSelection,
  EditorState,
  type StateCommand,
  Transaction,
} from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { eienChange, eienEffects, eienUndo } from './eien-change';

/**
 * On a transaction the document sends a view: the view it was made in
 * ('own': the writer's undo, or Eien's change), or another showing the same
 * note ('echo': not news to tell again). Either way it's in the document.
 */
export const fromDoc = Annotation.define<'own' | 'echo'>();

/** Whether `tr` only echoes a change made in another view: told and counted there. */
export const isEcho = (tr: Transaction): boolean => tr.annotation(fromDoc) === 'echo';

export class NoteDoc {
  #state: EditorState;
  readonly #views = new Set<EditorView>();

  constructor(text: string) {
    this.#state = NoteDoc.#fresh(text);
  }

  static #fresh(text: string): EditorState {
    return EditorState.create({ doc: text, extensions: [history(), eienUndo] });
  }

  get text(): string {
    return this.#state.doc.toString();
  }

  /** How many views show it: none, and it's let go. */
  get shown(): number {
    return this.#views.size;
  }

  attach(view: EditorView): void {
    this.#views.add(view);
  }

  detach(view: EditorView): void {
    this.#views.delete(view);
  }

  /**
   * A view's transactions, as its `dispatchTransactions`: the view takes
   * them, and each change of its own goes to the document (its history) and
   * on to the other views.
   */
  dispatch(from: EditorView, trs: readonly Transaction[]): void {
    from.update(trs);
    for (const tr of trs) {
      if (tr.changes.empty || tr.annotation(fromDoc)) continue;
      this.#record(tr);
      this.#send(tr.changes, from, null);
    }
  }

  /**
   * Run a history command (undo, redo, or their selection-only kinds) for
   * `from`: on the document's history, its changes then sent to every view,
   * the selection to `from`. False when there's nothing to do.
   */
  run(from: EditorView, command: StateCommand): boolean {
    if (from.state.readOnly) return false;
    let done: Transaction | null = null;
    command({ state: this.#state, dispatch: (tr) => (done = tr) });
    const tr = done as Transaction | null;
    if (!tr) return false;
    this.#state = tr.state;
    if (tr.changes.empty) from.dispatch({ selection: tr.selection, scrollIntoView: true });
    else this.#send(tr.changes, from, tr);
    return true;
  }

  /**
   * Eien's change for `from` (the id a seal adds, a restore): the one
   * stretch that differs from `next`, as Eien's own, ⌘Z taking it back only
   * if `undoable`. `from` tells it (it's saved, and counted by no one).
   */
  amend(from: EditorView, next: string, undoable: boolean): void {
    const doc = this.text;
    let start = 0;
    while (start < doc.length && start < next.length && doc[start] === next[start]) start++;
    let end = doc.length;
    let endNext = next.length;
    while (end > start && endNext > start && doc[end - 1] === next[endNext - 1]) {
      end--;
      endNext--;
    }
    if (start === end && start === endNext) return;
    const tr = this.#state.update({
      changes: { from: start, to: end, insert: next.slice(start, endNext) },
      ...eienChange(undoable),
    });
    this.#state = tr.state;
    this.#send(tr.changes, from, tr);
  }

  /**
   * The same note's text, changed elsewhere (a reload): every view takes it,
   * each keeping its selection where it can, and the history starts afresh,
   * so ⌘Z never steps back over the other device's words. No view tells it:
   * the session that read it knows.
   */
  replace(text: string): void {
    const length = this.#state.doc.length;
    this.#state = NoteDoc.#fresh(text);
    for (const view of this.#views) {
      const { main } = view.state.selection;
      view.dispatch({
        changes: { from: 0, to: length, insert: text },
        selection: EditorSelection.range(
          Math.min(main.anchor, text.length),
          Math.min(main.head, text.length),
        ),
        annotations: fromDoc.of('echo'),
      });
    }
  }

  /** A view's change, into the document's history: from where its caret was, with what the history reads. */
  #record(tr: Transaction): void {
    let state = this.#state;
    // Where the caret was when the change began, so an undo puts it back there.
    if (!state.selection.eq(tr.startState.selection)) {
      state = state.update({
        selection: tr.startState.selection,
        annotations: Transaction.addToHistory.of(false),
      }).state;
    }
    const userEvent = tr.annotation(Transaction.userEvent);
    const toHistory = tr.annotation(Transaction.addToHistory);
    const isolate = tr.annotation(isolateHistory);
    this.#state = state.update({
      changes: tr.changes,
      selection: tr.newSelection,
      effects: eienEffects(tr),
      annotations: [
        ...(userEvent === undefined ? [] : [Transaction.userEvent.of(userEvent)]),
        ...(toHistory === undefined ? [] : [Transaction.addToHistory.of(toHistory)]),
        ...(isolate === undefined ? [] : [isolateHistory.of(isolate)]),
      ],
    }).state;
  }

  /**
   * `changes`, already in the document, to the views: `own`, when the
   * document made them for `from` (an undo, Eien's change), to `from` as its
   * own, carrying what tells whose they were; to every other view, an echo.
   */
  #send(changes: ChangeSet, from: EditorView, own: Transaction | null): void {
    for (const view of this.#views) {
      if (view === from && own) {
        const userEvent = own.annotation(Transaction.userEvent);
        view.dispatch({
          changes,
          selection: own.selection,
          effects: eienEffects(own),
          annotations: [
            fromDoc.of('own'),
            ...(userEvent === undefined ? [] : [Transaction.userEvent.of(userEvent)]),
          ],
          scrollIntoView: true,
        });
      } else if (view !== from) view.dispatch({ changes, annotations: fromDoc.of('echo') });
    }
  }
}
