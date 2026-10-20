// The editor's writing tools (spec §4): a scene break by Enter on an empty
// line after an empty line; focus mode, every paragraph but the one being
// written dimmed; and typewriter scrolling, the line being written held at
// the middle of the page. Focus and typewriter are this device's settings.

import { syntaxTree } from '@codemirror/language';
import { EditorState, type Extension, type Range, type TransactionSpec } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { frontMatterEnd } from '../../core/text';
import { isLiteralAt } from './typing';

export interface WritingTools {
  readonly focus: boolean;
  readonly typewriter: boolean;
  /** The system's spellcheck underlines words (macOS: the window allows it nowhere else). */
  readonly spellcheck: boolean;
}

export const NO_TOOLS: WritingTools = { focus: false, typewriter: false, spellcheck: false };

const SCENE_BREAK = '***';

/** Whether a line is blank as Markdown has it: nothing but spaces and tabs (a no-break space is text). */
const blank = (text: string) => /^[ \t]*$/u.test(text);

/** Whether line `n` is a scene break, however written: "***", "* * *", "---", "___", "<hr>". */
function isSceneBreak(state: EditorState, n: number): boolean {
  const line = state.doc.line(n);
  if (/^\s*<hr\b[^<>]*>\s*$/iu.test(line.text)) return true;
  const start = line.from + (line.text.length - line.text.trimStart().length);
  for (let node = syntaxTree(state).resolveInner(start, 1); node.parent; node = node.parent) {
    if (node.name === 'HorizontalRule') return true;
  }
  return false;
}

/** Whether `pos` is inside a block of raw HTML (a <pre> runs on over blank lines), where "***" is only text. */
function inHtmlBlock(state: EditorState, pos: number): boolean {
  for (const side of [-1, 1] as const) {
    for (let node = syntaxTree(state).resolveInner(pos, side); node.parent; node = node.parent) {
      if (node.name === 'HTMLBlock' && node.from < pos && node.to > pos) return true;
    }
  }
  return false;
}

/**
 * Enter on an empty line after an empty line: the line becomes a scene
 * break, "***", with a new paragraph after it. Only after some writing (the
 * front matter isn't writing), never beside another scene break however it's
 * written, and never in code, raw HTML or the front matter. The change, or
 * null for Enter's own.
 */
export function sceneBreakAt(state: EditorState): TransactionSpec | null {
  const { main } = state.selection;
  if (!main.empty || state.readOnly || state.selection.ranges.length > 1) return null;
  const { doc } = state;
  const line = doc.lineAt(main.head);
  if (line.number < 3 || !blank(line.text) || !blank(doc.line(line.number - 1).text)) return null;
  // The writing before the blank lines, and after: some before, and no scene break either side.
  let before = line.number - 2;
  while (before > 0 && blank(doc.line(before).text)) before--;
  const writing = doc.sliceString(0, Math.min(doc.length, 65_536));
  if (before === 0 || doc.line(before).from < frontMatterEnd(writing)) return null;
  let after = line.number + 1;
  while (after <= doc.lines && blank(doc.line(after).text)) after++;
  if (isSceneBreak(state, before) || (after <= doc.lines && isSceneBreak(state, after)))
    return null;
  if (isLiteralAt(state, line.from) || inHtmlBlock(state, line.from)) return null;
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

/**
 * The lines of the paragraph the caret is in (the lines up to a blank one
 * either side); with words chosen, every paragraph they touch.
 */
export function currentParagraph(state: EditorState): DecorationSet {
  const { doc } = state;
  const { main } = state.selection;
  const top = doc.lineAt(main.from);
  const bottom = doc.lineAt(main.to);
  let first = top.number;
  let last = bottom.number;
  if (!blank(top.text)) {
    while (first > 1 && top.number - first < REACH && !blank(doc.line(first - 1).text)) first--;
  }
  if (!blank(bottom.text)) {
    while (last < doc.lines && last - bottom.number < REACH && !blank(doc.line(last + 1).text)) {
      last++;
    }
  }
  const lines: Range<Decoration>[] = [];
  for (let n = first; n <= last; n++) lines.push(currentLine.range(doc.line(n).from));
  return Decoration.set(lines);
}

/** What focus mode keeps bright: nothing in Reading, where no one is writing. */
const brightIn = (state: EditorState): DecorationSet =>
  state.readOnly ? Decoration.none : currentParagraph(state);

/** Focus mode: the caret's paragraph is marked, and the editor's class dims the rest. */
export const focusMode: Extension = [
  EditorView.editorAttributes.of((view) => (view.state.readOnly ? null : { class: 'eien-focus' })),
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = brightIn(view.state);
      }
      update(update: ViewUpdate) {
        const readOnly = update.startState.readOnly !== update.state.readOnly;
        if (update.docChanged || update.selectionSet || readOnly) {
          this.decorations = brightIn(update.state);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
];

/**
 * Typewriter scrolling: what the writer types, deletes or moves the caret to
 * with the keyboard brings its line to the middle of the page. A click or a
 * drop leaves the page where it is (the line is already where the writer
 * looks), and so does choosing words (⌘A would send the page to the end).
 */
export const typewriter: Extension = [
  EditorView.editorAttributes.of({ class: 'eien-typewriter' }),
  EditorState.transactionExtender.of((tr) => {
    const byKeys =
      (tr.isUserEvent('input') && !tr.isUserEvent('input.drop')) ||
      tr.isUserEvent('delete') ||
      tr.isUserEvent('undo') ||
      tr.isUserEvent('redo') ||
      (tr.isUserEvent('select') && !tr.isUserEvent('select.pointer') && tr.newSelection.main.empty);
    if (!byKeys) return null;
    return { effects: EditorView.scrollIntoView(tr.newSelection.main.head, { y: 'center' }) };
  }),
];

/** The tools as `tools` has them on. */
export const writingTools = (tools: WritingTools): Extension => [
  tools.focus ? focusMode : [],
  tools.typewriter ? typewriter : [],
  // Off until the writer asks for it (spec §1): nothing underlined while they write.
  EditorView.contentAttributes.of({ spellcheck: tools.spellcheck ? 'true' : 'false' }),
];

/** Bring the caret's line to the middle now: typewriter scrolling just turned on. */
export const centreCaret = (view: EditorView): void =>
  view.dispatch({
    effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: 'center' }),
  });
