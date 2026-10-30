// The note editor (spec §4): CodeMirror in three views of the same text —
// Live (the default: marks hidden but on the lines being edited), Source
// (the raw file) and Reading (as it reads, read-only).
//
// It lives in a shadow root: there CodeMirror's own styles load as
// constructed style sheets, which the content security policy allows,
// where a <style> element would be refused. The design tokens still reach
// it; custom properties inherit into shadow roots.

import { Compartment, EditorSelection, EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { FormatCommand, FormatCommandId } from '../../core/format';
import type { QuoteStyle } from '../../core/typography';
import { h } from '../dom';
import type { FindBar } from '../find/find-bar';
import { activeFormats } from './active-formats';
import { editorKeys, historyInput } from './editor-keys';
import {
  lockExtensions,
  marksExtensions,
  modeExtensions,
  tagsAndIdsExtensions,
} from './editor-modes';
import { writtenBy } from './eien-change';
import { findInNote, NoteFind } from './find';
import { frontMatterHidden, writingStart } from './front-matter-hidden';
import { imageDrop } from './image-drop';
import type { LinkNote } from './link-presenter';
import { type LinkStyle, LinkTooltips } from './link-tooltips';
import { linkFollowing } from './links';
import { isEcho, type NoteDoc } from './note-doc';
import { eienMarkdown } from './syntax';
import { caretTable } from './table-at';
import { tableEditor } from './table-editor';
import { openCellMenu } from './table-menus';
import { editorTheme, markdownColours } from './theme';
import { htmlPaste, quoteTyping } from './typing';
import { type ImageLoader, imageLoader } from './widgets';
import { centreCaret, NO_TOOLS, type WritingTools, writingTools } from './writing-tools';

export type EditorMode = 'live' | 'source' | 'reading';

/** No images: an editor with no note. */
const NO_IMAGES: ImageLoader = async () => null;
export const EDITOR_MODES: readonly EditorMode[] = ['live', 'source', 'reading'];

export interface EditorEvents {
  /**
   * The text changed in this view (not a reload, nor another view's echo): `written` when the
   * writer did it — typed, cut, pasted, formatted, undid — not Eien (a
   * seal's id, a restore), which counts toward no one's words.
   */
  changed(text: string, written: boolean): void;
  /** The text changed in another view of the same note (or a reload), told and counted there. */
  echoed?(text: string): void;
  /** A link was followed: a web address, or a [[note]] by its title. */
  follow(target: { readonly kind: 'url' | 'note'; readonly value: string }): void;
  /** The note a [[link]] names, as the list shows it, for its card; null when there's none. */
  about?(name: string): LinkNote | null;
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
  /** The front matter's tags: and id: lines out of sight, as this device's setting says. */
  readonly #tagsAndIds = new Compartment();
  #tagsAndIdsHidden = false;
  /** Held still while its note is moved or trashed: no typing reaches it. */
  #locked = false;
  readonly #events: EditorEvents;
  #current: EditorMode = 'live';
  /** The note shown: its text and its history, shared with any other view of it (./note-doc.ts). */
  #doc: NoteDoc | null = null;

  /**
   * Where a table's grips and + are drawn (./table-tools.ts): the editor's
   * own, kept from note to note; the page lays it over the editor, outside
   * its shadow root, so they're the window's own controls. Quiet controls
   * it turns on itself, not by the sheet's hover (../chrome/chrome.css).
   */
  readonly tableTools = h('div', { class: 'table-tools quiet-own' });

  /**
   * A link's tools in Live (./link-tooltips.ts): its card or bar float in
   * `links.layer` and dock in `links.dock`, which the page places, outside
   * the editor's shadow root.
   */
  readonly links: LinkTooltips = new LinkTooltips(() => this.#view, {
    follow: (target) => this.#events.follow(target),
    about: (name) => this.#events.about?.(name) ?? null,
    tell: (words) => this.#events.said?.(words),
  });

  /** Find and replace in the note (./find.ts): what the find bar searches here. */
  readonly #find = new NoteFind(() => this.#view);
  /** The find bar (../find/find-bar.ts): the window's own slip, which the page lays over it. */
  readonly find: FindBar = this.#find.bar;

  constructor(host: HTMLElement, events: EditorEvents) {
    this.#events = events;
    const root = host.attachShadow({ mode: 'open' });
    this.#view = new EditorView({
      root,
      parent: root,
      state: this.#state('', NO_IMAGES),
      // Every change goes through the note's document, which keeps its history and its other views.
      dispatchTransactions: (trs, view) =>
        this.#doc ? this.#doc.dispatch(view, trs) : view.update(trs),
    });
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

  /** A note: its document's text and history (./note-doc.ts), images from `loadImage`. */
  show(doc: NoteDoc, loadImage: ImageLoader): void {
    this.links.hide();
    this.#doc?.detach(this.#view);
    this.#doc = doc;
    const state = this.#state(doc.text, loadImage);
    // The caret starts where the writing does, after any front matter kept out of sight.
    const start = writingStart(state);
    this.#view.setState(start > 0 ? state.update({ selection: { anchor: start } }).state : state);
    this.#view.scrollDOM.scrollTop = 0;
    doc.attach(this.#view);
  }

  /** The page closed: the note let go, and the view with it. */
  destroy(): void {
    this.release();
    this.links.destroy();
    this.#view.destroy();
  }

  /** No note: the document is let go, and the editor holds nothing of it. */
  release(): void {
    this.links.hide();
    this.#doc?.detach(this.#view);
    this.#doc = null;
    this.#view.setState(this.#state('', NO_IMAGES));
  }

  /**
   * Change the text to `next` by the one stretch that differs, as a quiet
   * edit: the caret moves with the words around it, and the undo history
   * stays; `undoable` lets ⌘Z take this change back (a restore), or not (the
   * id a seal adds). False, changing nothing, while the text is held still.
   */
  amend(next: string, undoable: boolean): boolean {
    if (this.#locked || !this.#doc) return false;
    this.#doc.amend(this.#view, next, undoable);
    return true;
  }

  /**
   * Eien's addition at the note's end (a quote from a book, #40): `add` given
   * the text, returning it with the addition. One step ⌘Z takes back, the
   * caret after it and in sight, and the keyboard left where it is (the
   * book). False, changing nothing, while the text is held still.
   */
  addAtEnd(add: (text: string) => string): boolean {
    if (!this.amend(add(this.#view.state.doc.toString()), true)) return false;
    this.#view.dispatch({
      selection: { anchor: this.#view.state.doc.length },
      scrollIntoView: true,
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

  /** The front matter's tags: and id: lines hidden in every view (true), or shown (backlog #45). */
  setTagsAndIdsHidden(hidden: boolean): void {
    if (hidden === this.#tagsAndIdsHidden) return;
    this.#tagsAndIdsHidden = hidden;
    this.#view.dispatch({ effects: this.#tagsAndIds.reconfigure(tagsAndIdsExtensions(hidden)) });
  }

  /** How a link in Live shows where it goes, as the "Link editing" setting says (backlog #38). */
  setLinkStyle(style: LinkStyle): void {
    this.links.use(style);
  }

  /** Hold the text still (true) or let the writer type again (false). */
  setLocked(locked: boolean): void {
    this.#locked = locked;
    this.#view.dispatch({ effects: this.#lock.reconfigure(lockExtensions(locked)) });
  }

  #state(text: string, loadImage: ImageLoader): EditorState {
    const extensions: Extension[] = [
      this.#lock.of(lockExtensions(this.#locked)),
      this.#quotes.of(quoteTyping(this.#quoteStyle)),
      this.#tools.of(writingTools(this.#toolsOn)),
      this.#marks.of(marksExtensions(this.#marksShown)),
      this.#tagsAndIds.of(tagsAndIdsExtensions(this.#tagsAndIdsHidden)),
      frontMatterHidden,
      imageDrop((files, at) => {
        if (!this.#events.images) return false;
        this.#events.images(files, at);
        return true;
      }),
      htmlPaste,
      findInNote(this.#find),
      editorKeys(
        (command) => this.format(command),
        (command) => this.#doc?.run(this.#view, command) ?? false,
      ),
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
        // A change made in this view, told once: an echo of another view's was told there.
        if (!update.docChanged) return;
        const told = update.transactions.filter((tr) => tr.docChanged && !isEcho(tr));
        if (told.length > 0)
          this.#events.changed(update.state.doc.toString(), told.some(writtenBy));
        else this.#events.echoed?.(update.state.doc.toString());
      }),
      historyInput((command) => this.#doc?.run(this.#view, command) ?? false),
      linkFollowing(
        (target) => this.#events.follow(target),
        () => this.#current,
      ),
      this.links.extension,
    ];
    return EditorState.create({ doc: text, extensions });
  }
}
