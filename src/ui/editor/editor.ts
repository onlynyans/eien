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
import { FORMAT_COMMANDS, type FormatCommand } from '../../core/format';
import { livePreview, previewMode } from './live-preview';
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
    this.#view.setState(this.#state(text, loadImage));
    this.#view.scrollDOM.scrollTop = 0;
  }

  /** The same note's text, changed elsewhere: keep the selection where it can stay. */
  replaceText(text: string): void {
    const { main } = this.#view.state.selection;
    this.#quiet = true;
    this.#view.dispatch({
      changes: { from: 0, to: this.#view.state.doc.length, insert: text },
      selection: EditorSelection.range(Math.min(main.anchor, text.length), Math.min(main.head, text.length)),
    });
    this.#quiet = false;
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

  #state(text: string, loadImage: ImageLoader): EditorState {
    const formatKeys = FORMAT_COMMANDS.map((command) => ({ key: command.key, run: () => this.format(command) }));
    const extensions: Extension[] = [
      history(),
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
        click: (event, view) => this.#follow(event, view),
      }),
    ];
    return EditorState.create({ doc: text, extensions });
  }

  /** ⌘-click (Ctrl-click) a link to follow it; in Reading a plain click does. */
  #follow(event: MouseEvent, view: EditorView): boolean {
    if (this.#current !== 'reading' && !(event.metaKey || event.ctrlKey)) return false;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;
    for (let node = syntaxTree(view.state).resolveInner(pos, 1); node.parent; node = node.parent) {
      const text = (from: number, to: number) => view.state.doc.sliceString(from, to);
      if (node.name === 'WikiLink') {
        this.#events.follow({ kind: 'note', value: text(node.from + 2, node.to - 2).split('|')[0]?.trim() ?? '' });
        return true;
      }
      if (node.name === 'Link' || node.name === 'Autolink' || node.name === 'URL') {
        const url = node.name === 'URL' ? node : node.getChild('URL');
        if (url) {
          this.#events.follow({ kind: 'url', value: text(url.from, url.to) });
          return true;
        }
      }
    }
    return false;
  }
}

function modeExtensions(mode: EditorMode): Extension {
  switch (mode) {
    case 'live':
      return [previewMode.of('live'), livePreview];
    case 'source':
      return [EditorView.editorAttributes.of({ class: 'eien-source' })];
    case 'reading':
      return [
        previewMode.of('reading'),
        livePreview,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.editorAttributes.of({ class: 'eien-reading' }),
      ];
  }
}
