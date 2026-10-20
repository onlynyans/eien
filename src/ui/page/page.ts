// The page: the open note on its sheet, the view switch above it, and the
// colophon beneath.

import { countWords } from '../../core/text';
import { h } from '../dom';
import { EDITOR_MODES, type EditorEvents, type EditorMode, NoteEditor } from '../editor/editor';
import { SelectionBar } from '../editor/selection-bar';
import type { ImageLoader } from '../editor/widgets';
import type { SaveState } from '../notes/note-session';

export interface PageNote {
  readonly crumbs: string;
  readonly title: string;
  readonly text: string;
  readonly loadImage: ImageLoader;
}

const STATE_WORDS: Record<SaveState, string> = {
  saved: '',
  unsaved: '',
  saving: '',
  failed: 'Not saved yet — trying again',
};

const MODE_LABEL: Record<EditorMode, string> = { live: 'Live', source: 'Source', reading: 'Reading' };

export class PageView {
  readonly editor: NoteEditor;
  readonly #crumbs = h('p', { class: 'crumbs label' });
  readonly #title = h('h1', { class: 'title' });
  readonly #notice = h('p', { class: 'notice', attrs: { role: 'status', hidden: true } });
  readonly #editorHost = h('div', { class: 'editor-host' });
  readonly #words = h('span', { class: 'colophon__words' });
  readonly #state = h('span', { class: 'colophon__state', attrs: { role: 'status' } });
  readonly #modes: HTMLButtonElement[];
  readonly #sheet = h('article', { class: 'sheet' }, this.#crumbs, this.#title, this.#notice, this.#editorHost);
  readonly #empty = h('p', { class: 'page__empty', text: 'Choose a note, or make a new one.' });
  #titleText = '';

  constructor(container: HTMLElement, events: EditorEvents) {
    this.editor = new NoteEditor(this.#editorHost, {
      changed: (text) => {
        this.#showWords(text);
        this.#showTitle(text);
        events.changed(text);
      },
      follow: events.follow,
    });
    this.#modes = EDITOR_MODES.map((mode) =>
      h('button', {
        class: 'word-button',
        text: MODE_LABEL[mode],
        attrs: { type: 'button', 'aria-pressed': String(mode === 'live'), 'data-mode': mode },
        on: { click: () => this.setMode(mode) },
      }),
    );
    container.replaceChildren(
      h('div', { class: 'page__bar' }, h('div', { class: 'page__views', attrs: { role: 'group', 'aria-label': 'View' } }, ...this.#modes)),
      h('div', { class: 'page__scroll' }, this.#sheet, this.#empty),
      h('footer', { class: 'colophon count' }, this.#words, this.#state),
    );
    new SelectionBar(container, this.editor);
    this.showNothing();
  }

  show(note: PageNote): void {
    this.#sheet.hidden = false;
    this.#empty.hidden = true;
    this.#crumbs.textContent = note.crumbs;
    this.#title.textContent = this.#titleText = note.title;
    this.#showTitle(note.text);
    this.editor.setText(note.text, note.loadImage);
    this.notice(null);
    this.state('saved');
    this.#showWords(note.text);
  }

  showNothing(): void {
    this.#sheet.hidden = true;
    this.#empty.hidden = false;
    this.#words.textContent = '';
    this.state('saved');
  }

  /** New text from elsewhere, keeping the selection near where it was. */
  replaceText(text: string): void {
    this.editor.replaceText(text);
    this.#showWords(text);
    this.#showTitle(text);
  }

  retitle(title: string, crumbs: string): void {
    this.#title.textContent = this.#titleText = title;
    this.#crumbs.textContent = crumbs;
    this.#showTitle(this.editor.text);
  }

  setMode(mode: EditorMode): void {
    this.editor.setMode(mode);
    for (const button of this.#modes) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }

  /** Live → Source → Reading → Live (⌘E). */
  nextMode(): void {
    const at = EDITOR_MODES.indexOf(this.editor.mode);
    this.setMode(EDITOR_MODES[(at + 1) % EDITOR_MODES.length] ?? 'live');
  }

  /** A quiet line on the sheet, or none. */
  notice(text: string | null): void {
    this.#notice.hidden = text === null;
    this.#notice.textContent = text ?? '';
  }

  state(state: SaveState): void {
    this.#state.textContent = STATE_WORDS[state];
    this.#state.dataset.state = state;
  }

  focus(): void {
    this.editor.focus();
  }

  /** A note that opens with its own "# Title" heading needn't show the title twice. */
  #showTitle(text: string): void {
    const first = /^\s*#[ \t]+(.+?)[ \t#]*$/m.exec(text.trimStart().split('\n', 1)[0] ?? '');
    const same = first?.[1]?.trim().toLocaleLowerCase() === this.#titleText.trim().toLocaleLowerCase();
    this.#title.hidden = same;
  }

  #showWords(text: string): void {
    const words = countWords(text);
    this.#words.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
  }
}
