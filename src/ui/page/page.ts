// A page: a note on its sheet (or outline cards in its place), with what
// the colophon says of it — its words, its save, its last seal — and its
// versions panel, which the page pane (./page-pane.ts) puts where they go. The
// pane holds one page, or two when the window is split.

import { opensWithTitle } from '../../core/note';
import { h } from '../dom';
import { EDITOR_MODES, type EditorEvents, type EditorMode, NoteEditor } from '../editor/editor';
import type { NoteDoc } from '../editor/note-doc';
import { SelectionBar } from '../editor/selection-bar';
import { TableBar } from '../editor/table-bar';
import type { ImageLoader } from '../editor/widgets';
import type { SaveState } from '../notes/note-session';
import { Notice } from '../vault/notice';
import { BoardHost } from './board-host';
import { PageTags, type PageTagsOf } from './page-tags';
import { WordCount } from './word-count';

export interface PageNote {
  readonly crumbs: string;
  readonly title: string;
  /** Its text and history, shared with any other page showing it (../editor/note-doc.ts). */
  readonly doc: NoteDoc;
  readonly loadImage: ImageLoader;
}

/** What the colophon says of the save: only a failure is worth a word. */
const STATE_WORDS: Partial<Record<SaveState, string>> = { failed: 'Not saved yet — trying again' };

export class PageView {
  readonly editor: NoteEditor;
  readonly #crumbs = h('p', { class: 'crumbs label' });
  /** The breadcrumb again, for a running head across the window (C's): the pane shows the active page's. */
  readonly runningCrumbs = h('p', { class: 'label running-crumbs' });
  /** Where a layout puts the note's tags (../chrome/layout-spec.ts, TagSlot). */
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
  /** The editor, with its table's controls laid over it (../editor/table.css). */
  readonly #editorFrame = h('div', { class: 'page__editor' }, this.#editorHost);
  /** In the editor's place while a seal is compared or shown (read only). */
  readonly #compareHost = h('div', { class: 'compare-host', attrs: { hidden: true } });
  /** The note's words, and what writing adds to them (./word-count.ts). */
  readonly words = new WordCount();
  /** Where outline cards lie, in the sheet's place (./board-host.ts). */
  readonly board: BoardHost;
  readonly #state = h('span', { class: 'colophon__state', attrs: { role: 'status' } });
  /** What the table editor just did ("Row 3 removed · ⌘Z puts it back"), for a while. */
  readonly #said = h('span', { class: 'colophon__said', attrs: { role: 'status' } });
  readonly #saying = new Notice(() => {
    this.#said.textContent = this.#saying.text ?? '';
  });
  /** A phone's table tools, above the keyboard while the caret's in a table (../editor/table-bar.ts). */
  readonly tableBar: TableBar;
  readonly #sheet = h(
    'article',
    { class: 'sheet' },
    h('div', { class: 'sheet__head' }, this.#crumbs, this.tagSlots.runningHead),
    this.#title,
    this.#titleField,
    this.tagSlots.underTitle,
    this.#notice,
    this.#editorFrame,
    this.#compareHost,
  );
  /** With no note open; it takes the keyboard when the page is given it. */
  readonly #empty = h('p', {
    class: 'page__empty',
    text: 'Choose a note, or make a new one.',
    attrs: { tabindex: '-1' },
  });
  /** The blotter round the sheet, scrolled: the page's own part of the pane. */
  readonly element: HTMLElement;
  /** The last seal. */
  readonly #sealLine = h('span', { class: 'colophon__seal' });
  /** What the colophon says of this page's note, for the pane to put in place. */
  readonly foot: {
    readonly tags: HTMLElement;
    readonly words: HTMLElement;
    readonly state: HTMLElement;
    readonly seal: HTMLElement;
    readonly said: HTMLElement;
  };
  /** Beside the pane: the versions panel. */
  readonly aside = h('div', { class: 'page__aside' });
  #titleText = '';
  readonly #caret = new Set<() => void>();
  readonly #rename: (typed: string) => void;
  /** The note's tags, in the slot the layout names (./page-tags.ts). */
  readonly tags: PageTags;

  /**
   * `layer` holds what floats over the page (the selection bar); `rename`
   * hears a title the writer typed, different from the one there; `tags`, the tags' needs.
   */
  constructor(
    layer: HTMLElement,
    events: EditorEvents & {
      rename(typed: string): void;
      readonly tags: Omit<PageTagsOf, 'editable'>;
    },
  ) {
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
        this.tags.edited();
        events.changed(text, written);
      },
      follow: events.follow,
      ...(events.images ? { images: events.images } : {}),
      moved: () => {
        this.tableBar.sync();
        for (const listener of this.#caret) listener();
      },
      said: (words) => this.#saying.tell(words),
    });
    this.#editorFrame.append(this.editor.tableTools);
    this.tableBar = new TableBar(this.editor.view);
    this.tags = new PageTags(this.editor, { ...events.tags, editable: () => !this.comparing });
    this.element = h('div', { class: 'page__scroll' }, this.#sheet, this.#empty);
    this.board = new BoardHost(this.element);
    this.element.append(this.board.element);
    this.foot = {
      tags: this.tagSlots.colophon,
      words: this.words.element,
      state: this.#state,
      seal: this.#sealLine,
      said: this.#said,
    };
    new SelectionBar(layer, this.editor);
    this.showNothing();
  }

  /** Hear the caret move, or the text change under it; returns a function to stop. */
  onCaret(listener: () => void): () => void {
    this.#caret.add(listener);
    return () => this.#caret.delete(listener);
  }

  /** Whether a note is on the page, its text there to change (not a seal compared). */
  get writable(): boolean {
    return !this.#sheet.hidden && !this.comparing && !this.board.shown;
  }

  /** The seals' parts: a line in the colophon, a panel beside. */
  attach(parts: { readonly sealLine: HTMLElement; readonly aside: HTMLElement }): void {
    this.#sealLine.replaceChildren(parts.sealLine);
    this.aside.replaceChildren(parts.aside);
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
    const { text } = note.doc;
    this.#showTitle(text);
    this.editor.show(note.doc, note.loadImage);
    this.notice(null);
    this.state('saved');
    this.words.show(text);
    this.tags.show(text);
  }

  showNothing(): void {
    // The note gone (closed, trashed, gone from disk) with the keyboard in it: the page takes it.
    const had = this.#sheet.contains(document.activeElement);
    this.#sheet.hidden = true;
    this.#empty.hidden = false;
    this.runningCrumbs.textContent = '';
    this.editor.release();
    this.words.clear();
    this.tags.clear();
    this.state('saved');
    if (had && !this.board.shown) this.#empty.focus();
  }

  /** The note read again from disk: its document has the new text already (../vault/open-notes.ts). */
  reloaded(text: string): void {
    this.words.show(text);
    this.tags.show(text);
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
