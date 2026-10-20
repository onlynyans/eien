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

/** How long typing pauses before the word count catches up. */
const COUNT_AFTER_MS = 250;

const MODE_LABEL: Record<EditorMode, string> = {
  live: 'Live',
  source: 'Source',
  reading: 'Reading',
};

export class PageView {
  readonly editor: NoteEditor;
  readonly #crumbs = h('p', { class: 'crumbs label' });
  readonly #title = h('h1', {
    class: 'title',
    attrs: { tabindex: '0', title: 'Rename', 'aria-keyshortcuts': 'Enter F2' },
  });
  /** The title as a field, while it's being renamed. */
  readonly #titleField = h('input', {
    class: 'title__field',
    attrs: { type: 'text', 'aria-label': 'Title', spellcheck: 'false', hidden: true },
  });
  readonly #notice = h('p', { class: 'notice', attrs: { role: 'status', hidden: true } });
  readonly #editorHost = h('div', { class: 'editor-host' });
  readonly #words = h('span', { class: 'colophon__words' });
  readonly #state = h('span', { class: 'colophon__state', attrs: { role: 'status' } });
  readonly #zoom = h('span', { class: 'colophon__zoom', attrs: { 'aria-label': 'Zoom' } });
  /** News from the last action, when neither the list nor the sidebar is there to show it. */
  readonly #news = h('span', { class: 'colophon__news', attrs: { role: 'status' } });
  readonly #modes: HTMLButtonElement[];
  readonly #sheet = h(
    'article',
    { class: 'sheet' },
    this.#crumbs,
    this.#title,
    this.#titleField,
    this.#notice,
    this.#editorHost,
  );
  /** With no note open; it takes the keyboard when the page is given it. */
  readonly #empty = h('p', {
    class: 'page__empty',
    text: 'Choose a note, or make a new one.',
    attrs: { tabindex: '-1' },
  });
  /** The start of the bar: the panes' controls, when the window gives them. */
  readonly #lead = h('div', { class: 'page__lead' });
  #titleText = '';
  #counting: ReturnType<typeof setTimeout> | undefined;
  readonly #rename: (typed: string) => void;

  /** `rename` hears a title the writer typed, different from the one there. */
  constructor(container: HTMLElement, events: EditorEvents & { rename(typed: string): void }) {
    this.#rename = events.rename;
    // The title is the note's name: a click, Enter or F2 renames it (spec §2).
    this.#title.addEventListener('click', () => this.editTitle());
    this.#title.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== 'F2') return;
      event.preventDefault();
      this.editTitle();
    });
    this.#titleField.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.#finishTitle(true);
      else if (event.key === 'Escape') this.#finishTitle(false);
      else return;
      event.preventDefault();
    });
    // Switching to another app isn't leaving the field: the half-typed title waits.
    this.#titleField.addEventListener('blur', () => {
      if (document.hasFocus()) this.#finishTitle(true);
    });
    this.editor = new NoteEditor(this.#editorHost, {
      changed: (text) => {
        this.#countLater(text);
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
      h(
        'div',
        { class: 'page__bar' },
        this.#lead,
        h(
          'div',
          { class: 'page__views', attrs: { role: 'group', 'aria-label': 'View' } },
          ...this.#modes,
        ),
      ),
      h('div', { class: 'page__scroll' }, this.#sheet, this.#empty),
      h('footer', { class: 'colophon count' }, this.#words, this.#state, this.#zoom, this.#news),
    );
    new SelectionBar(container, this.editor);
    this.showNothing();
  }

  /** News from the last action in the status line; null takes it away. */
  news(text: string | null): void {
    this.#news.textContent = text ?? '';
  }

  /** Put `controls` at the start of the bar. */
  lead(controls: HTMLElement): void {
    this.#lead.replaceChildren(controls);
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
    clearTimeout(this.#counting);
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
    for (const button of this.#modes)
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }

  /** Live → Source → Reading → Live (⌘E). */
  nextMode(): void {
    const at = EDITOR_MODES.indexOf(this.editor.mode);
    this.setMode(EDITOR_MODES[(at + 1) % EDITOR_MODES.length] ?? 'live');
  }

  /** The page's zoom, in the colophon when it isn't 100%. */
  showZoom(percent: number): void {
    this.#zoom.textContent = percent === 100 ? '' : `${percent}%`;
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

  /** The keyboard to the note; with none open, to the page itself, never to nowhere. */
  focus(): void {
    if (this.#sheet.hidden) this.#empty.focus();
    else this.editor.focus();
  }

  /** Rename the note: its title becomes a field, the words chosen; Enter keeps them, Esc doesn't. */
  editTitle(): void {
    if (this.#sheet.hidden) return;
    this.#titleField.value = this.#titleText;
    this.#titleField.hidden = false;
    this.#title.hidden = true;
    this.#titleField.focus();
    this.#titleField.select();
  }

  #finishTitle(keep: boolean): void {
    if (this.#titleField.hidden) return;
    const typed = this.#titleField.value;
    this.#titleField.hidden = true;
    this.#showTitle(this.editor.text);
    if (keep && typed.trim() && typed !== this.#titleText) this.#rename(typed);
    else this.editor.focus();
  }

  /** A note that opens with its own "# Title" heading needn't show the title twice. */
  #showTitle(text: string): void {
    if (!this.#titleField.hidden) return; // being renamed: the field stands in for it
    const first = /^\s*#[ \t]+(.+?)[ \t#]*$/m.exec(text.trimStart().split('\n', 1)[0] ?? '');
    const same =
      first?.[1]?.trim().toLocaleLowerCase() === this.#titleText.trim().toLocaleLowerCase();
    this.#title.hidden = same;
  }

  /** Counting reads the whole note: while typing, once it pauses. */
  #countLater(text: string): void {
    clearTimeout(this.#counting);
    this.#counting = setTimeout(() => this.#showWords(text), COUNT_AFTER_MS);
  }

  #showWords(text: string): void {
    clearTimeout(this.#counting);
    const words = countWords(text);
    this.#words.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
  }
}
