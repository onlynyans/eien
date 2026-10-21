// The page: the open note on its sheet, the colophon beneath, and the slots
// the layout draws its controls in (../chrome): the bar above, the
// formatting bar's row under it, and a phone's foot.

import { opensWithTitle } from '../../core/note';
import { h } from '../dom';
import { EDITOR_MODES, type EditorEvents, type EditorMode, NoteEditor } from '../editor/editor';
import { SelectionBar } from '../editor/selection-bar';
import type { ImageLoader } from '../editor/widgets';
import type { SaveState } from '../notes/note-session';
import { BoardHost } from './board-host';
import { WordCount } from './word-count';

export interface PageNote {
  readonly crumbs: string;
  readonly title: string;
  readonly text: string;
  readonly loadImage: ImageLoader;
}

/** What the colophon says of the save: only a failure is worth a word. */
const STATE_WORDS: Partial<Record<SaveState, string>> = { failed: 'Not saved yet — trying again' };

export class PageView {
  readonly editor: NoteEditor;
  readonly #crumbs = h('p', { class: 'crumbs label' });
  /** The breadcrumb again, for a running head across the window (C's). */
  readonly runningCrumbs = h('p', { class: 'crumbs label running-crumbs' });
  /** Where a layout puts the note's tags (../chrome/layout-spec.ts, TagSlot); empty until they're built. */
  readonly tagSlots = {
    runningHead: h('div', { class: 'sheet__tags' }),
    underTitle: h('div', { class: 'title-tags' }),
    colophon: h('span', { class: 'colophon__tags' }),
  };
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
  /** In the editor's place while a seal is compared or shown (read only). */
  readonly #compareHost = h('div', { class: 'compare-host', attrs: { hidden: true } });
  /** The note's words, and what writing adds to them (./word-count.ts). */
  readonly words = new WordCount();
  /** Where outline cards lie, in the sheet's place (./board-host.ts). */
  readonly board: BoardHost;
  /** In the colophon, after the save state: today's words, the book's, a sprint (ui/counters). */
  readonly #counters = h('span', { class: 'colophon__counters' });
  readonly #state = h('span', { class: 'colophon__state', attrs: { role: 'status' } });
  readonly #zoom = h('span', { class: 'colophon__zoom', attrs: { 'aria-label': 'Zoom' } });
  /** News from the last action, when neither the list nor the sidebar is there to show it. */
  readonly #news = h('span', { class: 'colophon__news', attrs: { role: 'status' } });
  readonly #sheet = h(
    'article',
    { class: 'sheet' },
    h('div', { class: 'sheet__head' }, this.#crumbs, this.tagSlots.runningHead),
    this.#title,
    this.#titleField,
    this.tagSlots.underTitle,
    this.#notice,
    this.#editorHost,
    this.#compareHost,
  );
  /** With no note open; it takes the keyboard when the page is given it. */
  readonly #empty = h('p', {
    class: 'page__empty',
    text: 'Choose a note, or make a new one.',
    attrs: { tabindex: '-1' },
  });
  /** Where the layout draws its controls (../chrome/layout-spec.ts): each part has its own row. */
  readonly slots = {
    bar: h('div', { class: 'page__bar' }),
    /** The formatting bar's row; empty until it's built. */
    format: h('div', { class: 'page__format' }),
    /** On a phone, the page's tools at its foot (B's slip, C's rail). */
    phone: h('div', { class: 'page__phone' }),
  };
  /** In the colophon, after the save state: the last seal. */
  readonly #sealLine = h('span', { class: 'colophon__seal' });
  /** Beside the page: the versions panel. */
  readonly #aside = h('div', { class: 'page__aside' });
  #titleText = '';
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
      changed: (text, written) => {
        this.words.edited(text, written);
        this.#showTitle(text);
        events.changed(text, written);
      },
      follow: events.follow,
    });
    const scroll = h('div', { class: 'page__scroll' }, this.#sheet, this.#empty);
    this.board = new BoardHost(scroll);
    scroll.append(this.board.element);
    container.replaceChildren(
      h(
        'div',
        { class: 'page__main' },
        this.slots.bar,
        this.slots.format,
        scroll,
        h(
          'footer',
          { class: 'colophon count' },
          this.tagSlots.colophon,
          this.words.element,
          this.#state,
          this.#counters,
          this.#sealLine,
          this.#zoom,
          this.#news,
        ),
        this.slots.phone,
      ),
      this.#aside,
    );
    new SelectionBar(container, this.editor);
    this.showNothing();
  }

  /** News from the last action in the status line; null takes it away. */
  news(text: string | null): void {
    this.#news.textContent = text ?? '';
  }

  /** Today's words, the book's and a sprint, in the colophon. */
  counters(element: HTMLElement): void {
    this.#counters.replaceChildren(element);
  }

  /** The seals' parts: a line in the colophon, a panel beside. */
  attach(parts: { readonly sealLine: HTMLElement; readonly aside: HTMLElement }): void {
    this.#sealLine.replaceChildren(parts.sealLine);
    this.#aside.replaceChildren(parts.aside);
  }

  /** Show `view` (read only) in the editor's place; null gives the editor back. */
  compare(view: HTMLElement | null): void {
    if (view) this.board.hide();
    this.#compareHost.replaceChildren(...(view ? [view] : []));
    this.#compareHost.hidden = view === null;
    this.#editorHost.hidden = view !== null;
  }

  /** Whether a seal is shown in the editor's place. */
  get comparing(): boolean {
    return !this.#compareHost.hidden;
  }

  show(note: PageNote): void {
    this.board.hide();
    this.#sheet.hidden = false;
    this.#empty.hidden = true;
    this.#crumbs.textContent = this.runningCrumbs.textContent = note.crumbs;
    this.#title.textContent = this.#titleText = note.title;
    this.#showTitle(note.text);
    this.editor.setText(note.text, note.loadImage);
    this.notice(null);
    this.state('saved');
    this.words.show(note.text);
  }

  showNothing(): void {
    // The note gone (closed, trashed, gone from disk) with the keyboard in it: the page takes it.
    const had = this.#sheet.contains(document.activeElement);
    this.#sheet.hidden = true;
    this.#empty.hidden = false;
    this.runningCrumbs.textContent = '';
    this.words.clear();
    this.state('saved');
    if (had && !this.board.shown) this.#empty.focus();
  }

  /** New text from elsewhere, keeping the selection near where it was. */
  replaceText(text: string): void {
    this.editor.replaceText(text);
    this.words.show(text);
    this.#showTitle(text);
  }

  retitle(title: string, crumbs: string): void {
    this.#title.textContent = this.#titleText = title;
    this.#crumbs.textContent = this.runningCrumbs.textContent = crumbs;
    this.#showTitle(this.editor.text);
  }

  setMode(mode: EditorMode): void {
    this.board.hide(); // a view chosen is the page's: it comes back
    this.editor.setMode(mode);
  }

  /** The view shown: Live, Source or Reading. */
  get mode(): EditorMode {
    return this.editor.mode;
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
    this.#state.textContent = STATE_WORDS[state] ?? '';
    this.#state.dataset.state = state;
  }

  /**
   * The keyboard to the note (on a touch screen only when `typing`: else to the title, so the
   * phone's keyboard stays down); with none open, to the page itself, never to nowhere.
   */
  focus(typing = false): void {
    if (this.board.shown) this.board.focus();
    else if (this.#sheet.hidden) this.#empty.focus();
    else if (this.comparing) this.#compareHost.querySelector<HTMLElement>('[tabindex]')?.focus();
    else if (typing || !matchMedia('(hover: none)').matches) this.editor.focus();
    else if (!this.#title.hidden) this.#title.focus();
    else (document.activeElement as HTMLElement | null)?.blur(); // the title is the note's own heading
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
    this.#title.hidden = opensWithTitle(text, this.#titleText);
  }
}
