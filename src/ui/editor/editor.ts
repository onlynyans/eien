// The note editor (spec §4): CodeMirror in three views of the same text —
// Live (the default: marks hidden but on the lines being edited), Source
// (the raw file) and Reading (as it reads, read-only).
//
// It lives in a shadow root: there CodeMirror's own styles load as
// constructed style sheets, which the content security policy allows,
// where a <style> element would be refused. The design tokens still reach
// it; custom properties inherit into shadow roots.

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import { Compartment, EditorSelection, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import {
  FORMAT_COMMANDS,
  type FormatCommand,
  type FormatCommandId,
  keyOn,
} from '../../core/format';
import type { QuoteStyle } from '../../core/typography';
import { h } from '../dom';
import { activeFormats } from './active-formats';
import { eienChange, eienUndo, writtenBy } from './eien-change';
import { hiddenMarkEditing } from './hidden-marks';
import { imageDrop } from './image-drop';
import {
  hiddenFrontMatter,
  keepFrontMatter,
  livePreview,
  previewMode,
  showMarks,
} from './live-preview';
import { tableCells } from './live-tables';
import { eienMarkdown } from './syntax';
import { caretTable } from './table-at';
import { tableEditing, tableEditor } from './table-editor';
import { openCellMenu } from './table-menus';
import { editorTheme, markdownColours } from './theme';
import { htmlPaste, quoteTyping } from './typing';
import { type ImageLoader, imageLoader } from './widgets';
import {
  centreCaret,
  NO_TOOLS,
  sceneBreak,
  type WritingTools,
  writingTools,
} from './writing-tools';

export type EditorMode = 'live' | 'source' | 'reading';
export const EDITOR_MODES: readonly EditorMode[] = ['live', 'source', 'reading'];

export interface EditorEvents {
  /**
   * The text changed (not by setText or replaceText): `written` when the
   * writer did it — typed, cut, pasted, formatted, undid — not Eien (a
   * seal's id, a restore), which counts toward no one's words.
   */
  changed(text: string, written: boolean): void;
  /** A link was followed: a web address, or a [[note]] by its title. */
  follow(target: { readonly kind: 'url' | 'note'; readonly value: string }): void;
  /** The caret moved, or the text changed under it: what's on at the caret may differ. */
  moved?(): void;
  /** Images were dropped at `at`, or pasted at the caret (null): add them to the note (./image-drop.ts). */
  images?(files: readonly File[], at: number | null): void;
  /** What the table editor did, for the colophon: "Row 3 removed · ⌘Z puts it back". */
  said?(words: string): void;
}

export class NoteEditor {
  readonly #view: EditorView;
  readonly #mode = new Compartment();
  readonly #images = new Compartment();
  readonly #history = new Compartment();
  readonly #lock = new Compartment();
  /** Typed quotes, as the vault's setting asks. */
  readonly #quotes = new Compartment();
  #quoteStyle: QuoteStyle = 'curly';
  /** Focus mode and typewriter scrolling, as this device's settings say. */
  readonly #tools = new Compartment();
  #toolsOn: WritingTools = NO_TOOLS;
  /** Live's marks on the caret's lines, or hidden there too, as this device's setting says. */
  readonly #marks = new Compartment();
  #marksShown = true;
  /** Held still while its note is moved or trashed: no typing reaches it. */
  #locked = false;
  readonly #events: EditorEvents;
  #current: EditorMode = 'live';
  /** Changes we make ourselves aren't the writer's typing. */
  #quiet = false;

  /**
   * Where a table's grips and + are drawn (./table-tools.ts): the editor's
   * own, kept from note to note; the page lays it over the editor, outside
   * its shadow root, so they're the window's own controls.
   */
  readonly tableTools = h('div', { class: 'table-tools' });

  constructor(host: HTMLElement, events: EditorEvents) {
    this.#events = events;
    const root = host.attachShadow({ mode: 'open' });
    this.#view = new EditorView({ root, parent: root, state: this.#state('', async () => null) });
  }

  get view(): EditorView {
    return this.#view;
  }
  get text(): string {
    return this.#view.state.doc.toString();
  }
  get mode(): EditorMode {
    return this.#current;
  }

  /** A new note: new text, new undo history, images from `loadImage`. */
  setText(text: string, loadImage: ImageLoader): void {
    const state = this.#state(text, loadImage);
    // The caret starts where the writing does, after any front matter kept out of sight.
    const start = hiddenFrontMatter(state);
    this.#view.setState(start > 0 ? state.update({ selection: { anchor: start } }).state : state);
    this.#view.scrollDOM.scrollTop = 0;
  }

  /**
   * The same note's text, changed elsewhere: keep the selection where it can
   * stay, and start the undo history afresh. A reload only comes when nothing
   * here is unsaved, so the history holds nothing to lose; and an undo must
   * never step back over the other device's words.
   */
  replaceText(text: string): void {
    const { main } = this.#view.state.selection;
    this.#quiet = true;
    this.#view.dispatch({
      changes: { from: 0, to: this.#view.state.doc.length, insert: text },
      selection: EditorSelection.range(
        Math.min(main.anchor, text.length),
        Math.min(main.head, text.length),
      ),
      effects: this.#history.reconfigure([]),
    });
    this.#view.dispatch({ effects: this.#history.reconfigure(history()) });
    this.#quiet = false;
  }

  /**
   * Change the text to `next` by the one stretch that differs, as a quiet
   * edit: the caret moves with the words around it, and the undo history
   * stays; `undoable` lets ⌘Z take this change back (a restore), or not (the
   * id a seal adds). False, changing nothing, while the text is held still.
   */
  amend(next: string, undoable: boolean): boolean {
    if (this.#locked) return false;
    const doc = this.#view.state.doc.toString();
    let start = 0;
    while (start < doc.length && start < next.length && doc[start] === next[start]) start++;
    let end = doc.length;
    let endNext = next.length;
    while (end > start && endNext > start && doc[end - 1] === next[endNext - 1]) {
      end--;
      endNext--;
    }
    if (start === end && start === endNext) return true;
    this.#view.dispatch({
      changes: { from: start, to: end, insert: next.slice(start, endNext) },
      ...eienChange(undoable),
    });
    return true;
  }

  setMode(mode: EditorMode): void {
    this.#current = mode;
    this.#view.dispatch({ effects: this.#mode.reconfigure(modeExtensions(mode)) });
  }

  /**
   * Run a formatting command on the selection (spec §4, Live). Table, with
   * the caret in a table in Live, opens the caret's cell's menus instead.
   */
  format(command: FormatCommand): boolean {
    const state = this.#view.state;
    if (state.readOnly) return false;
    if (command.id === 'table' && openCellMenu(this.#view)) return true;
    const { from, to } = state.selection.main;
    const edit = command.run(state.doc.toString(), { from, to });
    this.#view.dispatch({
      changes: [...edit.changes],
      selection: EditorSelection.range(edit.selection.from, edit.selection.to),
      userEvent: 'input.format',
      scrollIntoView: true,
    });
    this.#view.focus();
    return true;
  }

  focus(): void {
    this.#view.focus();
  }

  /**
   * Put `text` at `at` (where an image was dropped; the selection's place,
   * for null) as the writer's own edit, which ⌘Z takes back; the caret after
   * it. False, changing nothing, while the text is read only or held still.
   */
  insert(text: string, at: number | null, userEvent: 'input.drop' | 'input.paste'): boolean {
    const state = this.#view.state;
    if (state.readOnly) return false;
    const { from, to } =
      at === null
        ? state.selection.main
        : { from: Math.min(at, state.doc.length), to: Math.min(at, state.doc.length) };
    this.#view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
      userEvent,
      scrollIntoView: true,
    });
    this.#view.focus();
    return true;
  }

  /** The Format menu's commands on at the caret (./active-formats.ts). */
  get formats(): ReadonlySet<FormatCommandId> {
    return activeFormats(this.#view.state);
  }

  /** Whether the caret is in a table, in Live: the Table button is pressed. */
  get inTable(): boolean {
    return caretTable(this.#view.state) !== null;
  }

  /** The caret's line, as written. */
  get caretLine(): string {
    const { state } = this.#view;
    return state.doc.lineAt(state.selection.main.head).text;
  }

  /** Choose the words from `from` to `to`, in sight, with the keyboard on them (a tag in the text). */
  reveal(from: number, to: number): void {
    this.#view.dispatch({ selection: EditorSelection.range(from, to), scrollIntoView: true });
    this.#view.focus();
  }

  /** Where images come from: changed when the note moves to another folder. */
  setImageLoader(loadImage: ImageLoader): void {
    this.#view.dispatch({ effects: this.#images.reconfigure(imageLoader.of(loadImage)) });
  }

  /** Typed quotes curly or straight (spec §4). */
  setQuotes(style: QuoteStyle): void {
    if (style === this.#quoteStyle) return;
    this.#quoteStyle = style;
    this.#view.dispatch({ effects: this.#quotes.reconfigure(quoteTyping(style)) });
  }

  /** Focus mode, typewriter scrolling and spellcheck on or off (spec §4). */
  setTools(tools: WritingTools): void {
    const before = this.#toolsOn;
    const same = (Object.keys(tools) as (keyof WritingTools)[]).every(
      (k) => tools[k] === before[k],
    );
    if (same) return;
    this.#toolsOn = tools;
    this.#view.dispatch({ effects: this.#tools.reconfigure(writingTools(tools)) });
    if (tools.typewriter && !before.typewriter) centreCaret(this.#view);
  }

  /** Live shows the Markdown marks on the caret's lines (true), or keeps them hidden (spec §4). */
  setMarks(shown: boolean): void {
    if (shown === this.#marksShown) return;
    this.#marksShown = shown;
    this.#view.dispatch({ effects: this.#marks.reconfigure(marksExtensions(shown)) });
  }

  /** Hold the text still (true) or let the writer type again (false). */
  setLocked(locked: boolean): void {
    this.#locked = locked;
    this.#view.dispatch({ effects: this.#lock.reconfigure(lockExtensions(locked)) });
  }

  #state(text: string, loadImage: ImageLoader): EditorState {
    // CodeMirror takes `mac` on a Mac, `key` elsewhere.
    const formatKeys = FORMAT_COMMANDS.map((command) => ({
      key: keyOn(command, false),
      mac: keyOn(command, true),
      run: () => this.format(command),
    }));
    const extensions: Extension[] = [
      this.#history.of(history()),
      eienUndo,
      this.#lock.of(lockExtensions(this.#locked)),
      this.#quotes.of(quoteTyping(this.#quoteStyle)),
      this.#tools.of(writingTools(this.#toolsOn)),
      this.#marks.of(marksExtensions(this.#marksShown)),
      imageDrop((files, at) => {
        if (!this.#events.images) return false;
        this.#events.images(files, at);
        return true;
      }),
      htmlPaste,
      keymap.of([
        ...formatKeys,
        { key: 'Enter', run: sceneBreak },
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      eienMarkdown(),
      markdownColours,
      editorTheme,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        autocorrect: 'off',
        autocapitalize: 'off',
        'aria-label': 'Note',
      }),
      this.#images.of(imageLoader.of(loadImage)),
      tableEditor(this.tableTools, (words) => this.#events.said?.(words)),
      this.#mode.of(modeExtensions(this.#current)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged || update.selectionSet) this.#events.moved?.();
        if (!update.docChanged || this.#quiet) return;
        this.#events.changed(update.state.doc.toString(), update.transactions.some(writtenBy));
      }),
      EditorView.domEventHandlers({
        // ⌘-click follows on the press, before the caret moves: in Live a caret on
        // the link's line would show its marks and slide the words from under the pointer.
        mousedown: (event, view) => modClick(event) && this.#follow(event, view),
        // In Reading a plain click follows, as on a page; nothing there moves.
        click: (event, view) =>
          this.#current === 'reading' && !modClick(event) && this.#follow(event, view),
      }),
    ];
    return EditorState.create({ doc: text, extensions });
  }

  /** Follow the link under the pointer, if there is one. */
  #follow(event: MouseEvent, view: EditorView): boolean {
    const target = linkAt(view, event);
    if (!target) return false;
    event.preventDefault();
    this.#events.follow(target);
    return true;
  }
}

const MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform);

/** A click with ⌘ on a Mac, or Ctrl elsewhere (Ctrl-click on a Mac is the context menu). */
const modClick = (event: MouseEvent): boolean =>
  event.button === 0 && (MAC ? event.metaKey : event.ctrlKey);

/** The link under the pointer: a web address, or a [[note]] by its title. */
function linkAt(view: EditorView, event: MouseEvent): Parameters<EditorEvents['follow']>[0] | null {
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (pos === null) return null;
  const text = (from: number, to: number) => view.state.doc.sliceString(from, to);
  for (let node = syntaxTree(view.state).resolveInner(pos, 1); node.parent; node = node.parent) {
    if (node.name === 'WikiLink') {
      return {
        kind: 'note',
        value:
          text(node.from + 2, node.to - 2)
            .split('|')[0]
            ?.trim() ?? '',
      };
    }
    const url =
      node.name === 'URL'
        ? node
        : node.name === 'Link' || node.name === 'Autolink'
          ? node.getChild('URL')
          : null;
    if (url) return { kind: 'url', value: text(url.from, url.to) };
  }
  return null;
}

const marksExtensions = (shown: boolean): Extension =>
  shown ? [] : [showMarks.of(false), hiddenMarkEditing];

const lockExtensions = (locked: boolean): Extension =>
  locked ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [];

function modeExtensions(mode: EditorMode): Extension {
  switch (mode) {
    case 'live':
      return [previewMode.of('live'), livePreview, tableCells, keepFrontMatter, tableEditing];
    case 'source':
      return [EditorView.editorAttributes.of({ class: 'eien-source' })];
    case 'reading':
      return [
        previewMode.of('reading'),
        livePreview,
        tableCells,
        keepFrontMatter,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.editorAttributes.of({ class: 'eien-reading' }),
      ];
  }
}
