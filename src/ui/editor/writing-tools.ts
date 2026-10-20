// The editor's writing tools (spec §4): a scene break by Enter on an empty
// line after an empty line; focus mode, every paragraph but the one being
// written dimmed; and typewriter scrolling, the line being written held at
// the middle of the page. Focus and typewriter are this device's settings.

import { EditorState, type Extension, type Range, type TransactionSpec } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { isLiteralAt } from './typing';

export interface WritingTools {
  readonly focus: boolean;
  readonly typewriter: boolean;
}

export const NO_TOOLS: WritingTools = { focus: false, typewriter: false };

const SCENE_BREAK = '***';

/** Whether a line holds nothing but spaces. */
const blank = (text: string) => text.trim() === '';

/**
 * Enter on an empty line after an empty line: the line becomes a scene
 * break, "***", with a new paragraph after it. Not at the note's start, not
 * right after another scene break, and never in code or the front matter.
 * The change, or null for Enter's own.
 */
export function sceneBreakAt(state: EditorState): TransactionSpec | null {
  const { main } = state.selection;
  if (!main.empty || state.readOnly || state.selection.ranges.length > 1) return null;
  const line = state.doc.lineAt(main.head);
  if (line.number < 3 || !blank(line.text) || !blank(state.doc.line(line.number - 1).text)) {
    return null;
  }
  // The writing before the blank lines: there must be some, and not a scene break already.
  let before = line.number - 2;
  while (before > 0 && blank(state.doc.line(before).text)) before--;
  if (before === 0 || state.doc.line(before).text.trim() === SCENE_BREAK) return null;
  if (isLiteralAt(state, line.from)) return null;
  return {
    changes: { from: line.from, to: line.to, insert: `${SCENE_BREAK}\n\n` },
    selection: { anchor: line.from + SCENE_BREAK.length + 2 },
    userEvent: 'input',
    scrollIntoView: true,
  };
}

/** Enter, as a key binding: a scene break where sceneBreakAt finds one. */
export function sceneBreak(view: EditorView): boolean {
  const spec = sceneBreakAt(view.state);
  if (spec) view.dispatch(spec);
  return spec !== null;
}

const currentLine = Decoration.line({ class: 'eien-current' });

/** The most lines either side of the caret looked at for its paragraph: a paragraph longer is dimmed beyond. */
const REACH = 2000;

/** The lines of the paragraph the caret is in (the lines up to a blank one either side). */
export function currentParagraph(state: EditorState): DecorationSet {
  const { doc } = state;
  const at = doc.lineAt(state.selection.main.head);
  let first = at.number;
  let last = at.number;
  if (!blank(at.text)) {
    while (first > 1 && at.number - first < REACH && !blank(doc.line(first - 1).text)) first--;
    while (last < doc.lines && last - at.number < REACH && !blank(doc.line(last + 1).text)) last++;
  }
  const lines: Range<Decoration>[] = [];
  for (let n = first; n <= last; n++) lines.push(currentLine.range(doc.line(n).from));
  return Decoration.set(lines);
}

/** Focus mode: the caret's paragraph is marked, and the editor's class dims the rest. */
export const focusMode: Extension = [
  EditorView.editorAttributes.of({ class: 'eien-focus' }),
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = currentParagraph(view.state);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
          this.decorations = currentParagraph(update.state);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
];

/**
 * Typewriter scrolling: what the writer types, deletes or moves to with the
 * keyboard brings its line to the middle of the page. A click leaves the
 * page where it is: the line clicked is already where the writer looks.
 */
export const typewriter: Extension = [
  EditorView.editorAttributes.of({ class: 'eien-typewriter' }),
  EditorState.transactionExtender.of((tr) => {
    const byKeys =
      tr.isUserEvent('input') ||
      tr.isUserEvent('delete') ||
      tr.isUserEvent('undo') ||
      tr.isUserEvent('redo') ||
      (tr.isUserEvent('select') && !tr.isUserEvent('select.pointer'));
    if (!byKeys) return null;
    return { effects: EditorView.scrollIntoView(tr.newSelection.main.head, { y: 'center' }) };
  }),
];

/** The tools as `tools` has them on. */
export const writingTools = (tools: WritingTools): Extension => [
  tools.focus ? focusMode : [],
  tools.typewriter ? typewriter : [],
];

/** Bring the caret's line to the middle now: typewriter scrolling just turned on. */
export const centreCaret = (view: EditorView): void =>
  view.dispatch({
    effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: 'center' }),
  });
