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
import {
  Compartment,
  EditorSelection,
  EditorState,
  type Extension,
  Transaction,
} from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { FORMAT_COMMANDS, type FormatCommand } from '../../core/format';
import { hiddenFrontMatter, keepFrontMatter, livePreview, previewMode } from './live-preview';
import { eienMarkdown } from './syntax';
import { editorTheme, markdownColours } from './theme';
import { type ImageLoader, imageLoader } from './widgets';

export type EditorMode = 'live' | 'source' | 'reading';
export const EDITOR_MODES: readonly EditorMode[] = ['live', 'source', 'reading'];

export interface EditorEvents {
  /** The text changed by the writer (not by setText or replaceText). */
  changed(text: string): void;
  /** A link was followed: a web address, or a [[note]] by its title. */
  follow(target: { readonly kind: 'url' | 'note'; readonly value: string }): void;
}

export class NoteEditor {
  readonly #view: EditorView;
  readonly #mode = new Compartment();
  readonly #images = new Compartment();
  readonly #history = new Compartment();
  readonly #lock = new Compartment();
  /** Held still while its note is moved or trashed: no typing reaches it. */
  #locked = false;
  readonly #events: EditorEvents;
  #current: EditorMode = 'live';
  /** Changes we make ourselves aren't the writer's typing. */
  #quiet = false;

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
      annotations: undoable ? [] : [Transaction.addToHistory.of(false)],
    });
    return true;
  }

  setMode(mode: EditorMode): void {
    this.#current = mode;
    this.#view.dispatch({ effects: this.#mode.reconfigure(modeExtensions(mode)) });
  }

  /** Run a formatting command on the selection (spec §4, Live). */
  format(command: FormatCommand): boolean {
    const state = this.#view.state;
    if (state.readOnly) return false;
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

  /** Where images come from: changed when the note moves to another folder. */
  setImageLoader(loadImage: ImageLoader): void {
    this.#view.dispatch({ effects: this.#images.reconfigure(imageLoader.of(loadImage)) });
  }

  /** Hold the text still (true) or let the writer type again (false). */
  setLocked(locked: boolean): void {
    this.#locked = locked;
    this.#view.dispatch({ effects: this.#lock.reconfigure(lockExtensions(locked)) });
  }

  #state(text: string, loadImage: ImageLoader): EditorState {
    const formatKeys = FORMAT_COMMANDS.map((command) => ({
      key: command.key,
      run: () => this.format(command),
    }));
    const extensions: Extension[] = [
      this.#history.of(history()),
      this.#lock.of(lockExtensions(this.#locked)),
      keymap.of([...formatKeys, ...historyKeymap, ...defaultKeymap]),
      eienMarkdown(),
      markdownColours,
      editorTheme,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'off',
        'aria-label': 'Note',
      }),
      this.#images.of(imageLoader.of(loadImage)),
      this.#mode.of(modeExtensions(this.#current)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !this.#quiet) this.#events.changed(update.state.doc.toString());
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

const lockExtensions = (locked: boolean): Extension =>
  locked ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [];

function modeExtensions(mode: EditorMode): Extension {
  switch (mode) {
    case 'live':
      return [previewMode.of('live'), livePreview, keepFrontMatter];
    case 'source':
      return [EditorView.editorAttributes.of({ class: 'eien-source' })];
    case 'reading':
      return [
        previewMode.of('reading'),
        livePreview,
        keepFrontMatter,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.editorAttributes.of({ class: 'eien-reading' }),
      ];
  }
}
