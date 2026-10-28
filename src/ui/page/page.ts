// A page: a note on its sheet (./note-sheet.ts; or outline cards in its
// place), with what the colophon says of it — its words, its save, its last
// seal — and its versions panel, which the page pane (./page-pane.ts) puts
// where they go. The pane holds one page, or two when the window is split.
// This wires the editor, its words and tags, and the page's frame round the sheet.

import { h } from '../dom';
import { EDITOR_MODES, type EditorEvents, type EditorMode, NoteEditor } from '../editor/editor';
import type { NoteDoc } from '../editor/note-doc';
import { SelectionBar } from '../editor/selection-bar';
import { TableBar } from '../editor/table-bar';
import type { ImageLoader } from '../editor/widgets';
import type { SaveState } from '../notes/note-session';
import { BoardHost } from './board-host';
import { NoteFoot } from './note-foot';
import { NoteSheet } from './note-sheet';
import { type PageLeaf, type PaneLeaf, pageLeaf } from './page-leaf';
import { PageTags, type PageTagsOf } from './page-tags';
import { WordCount } from './word-count';

export interface PageNote {
  readonly crumbs: string;
  readonly title: string;
  /** Its text and history, shared with any other page showing it (../editor/note-doc.ts). */
  readonly doc: NoteDoc;
  readonly loadImage: ImageLoader;
}

export class PageView implements PaneLeaf {
  readonly editor: NoteEditor;
  /** Where a layout puts the note's tags (../chrome/layout-spec.ts, TagSlot). */
  readonly tagSlots = {
    runningHead: h('div', { class: 'sheet__tags' }),
    underTitle: h('div', { class: 'title-tags' }),
    colophon: h('span', { class: 'colophon__tags' }),
  };
  readonly #sheet: NoteSheet;
  /** The breadcrumb again, for a running head across the window (C's): the pane shows the active page's. */
  readonly runningCrumbs: HTMLElement;
  /** The note's words, and what writing adds to them (./word-count.ts). */
  readonly words = new WordCount();
  /** Where outline cards lie, in the sheet's place (./board-host.ts). */
  readonly board: BoardHost;
  /** A phone's table tools, above the keyboard while the caret's in a table (../editor/table-bar.ts). */
  readonly tableBar: TableBar;
  /** The page's own part of the pane: the blotter round the sheet, scrolled, its head and foot round it. */
  readonly element: HTMLElement;
  /** The blotter round the sheet, which scrolls: where a note's place is kept. */
  readonly scroll: HTMLElement;
  /** Its own head and foot, which the split's mode fills (./page-leaf.ts). */
  readonly head: PageLeaf['head'];
  readonly folio: PageLeaf['folio'];
  /** What the colophon says of this page's note: its tags, words, save and last seal (./note-foot.ts). */
  readonly foot = new NoteFoot(this.tagSlots.colophon, this.words.element);
  /** Beside the pane: the versions panel. */
  readonly aside = h('div', { class: 'page__aside' });
  readonly #caret = new Set<() => void>();
  /** The note's tags, in the slot the layout names (./page-tags.ts). */
  readonly tags: PageTags;
  readonly #selection: SelectionBar;

  /**
   * `layer` holds what floats over the page (the selection bar); `rename`
   * hears a title the writer typed, different from the one there; `tags`, the
   * tags' needs; `close`, the sheet's × (shown while the window is split).
   */
  constructor(
    layer: HTMLElement,
    events: EditorEvents & {
      rename(typed: string): void;
      close(): void;
      readonly tags: Omit<PageTagsOf, 'editable'>;
    },
  ) {
    this.#sheet = new NoteSheet(
      {
        rename: events.rename,
        done: () => this.editor.focus(),
        text: () => this.editor.text,
        close: () => events.close(),
      },
      this.tagSlots,
    );
    const { title } = this.#sheet;
    this.runningCrumbs = this.#sheet.runningCrumbs;
    this.editor = new NoteEditor(this.#sheet.editorHost, {
      changed: (text, written) => {
        this.words.edited(text, written);
        title.follow(text);
        this.tags.edited();
        events.changed(text, written);
      },
      // The same note typed in on the other page: its words, title and tags here follow.
      echoed: (text) => {
        this.words.echoed(text);
        title.follow(text);
        this.tags.edited();
      },
      follow: events.follow,
      ...(events.images ? { images: events.images } : {}),
      moved: () => {
        this.tableBar.sync();
        for (const listener of this.#caret) listener();
      },
      said: (words) => this.foot.tell(words),
    });
    this.#sheet.editorFrame.append(this.editor.tableTools);
    this.tableBar = new TableBar(this.editor.view);
    this.tags = new PageTags(this.editor, { ...events.tags, editable: () => !this.comparing });
    const scroll = h('div', { class: 'page__scroll' }, this.#sheet.element, this.#sheet.empty);
    this.scroll = scroll;
    this.board = new BoardHost(scroll);
    scroll.append(this.board.element);
    ({ element: this.element, head: this.head, folio: this.folio } = pageLeaf(scroll));
    this.element.append(this.editor.find.element);
    this.#selection = new SelectionBar(layer, this.editor);
    this.showNothing();
  }

  /** The page closed (a side of the split): its note let go, and all it holds with it. */
  dispose(): void {
    this.board.hide(); // outline cards on it are put away, not drawn again on a page gone
    this.showNothing();
    this.#selection.remove();
    this.foot.stop();
    this.editor.destroy();
    for (const part of [this.element, this.aside, this.tableBar.element, this.runningCrumbs])
      part.remove();
  }

  get under(): HTMLElement {
    return this.tableBar.element;
  }

  get tipped(): readonly HTMLElement[] {
    const { editor } = this;
    // A table's grips and + are in the editor's shadow root, so watched there.
    return [
      this.tags.set.element,
      editor.tableTools,
      this.under,
      this.#sheet.closer,
      editor.find.element,
    ];
  }

  /** # on the pane, outside the words and any field, opens the tags. */
  key(event: KeyboardEvent): void {
    this.tags.key(event);
  }

  /** Hear the caret move, or the text change under it; returns a function to stop. */
  onCaret(listener: () => void): () => void {
    this.#caret.add(listener);
    return () => this.#caret.delete(listener);
  }

  /** The note's name, as its title shows it; '' with no note on the page. */
  get name(): string {
    return this.#sheet.hasNote ? this.#sheet.title.text : '';
  }

  /** Whether a note is on the page, its text there to change (not a seal compared). */
  get writable(): boolean {
    return this.#sheet.hasNote && !this.comparing && !this.board.shown;
  }

  /** The seals' parts: a line in the colophon, a panel beside. */
  attach(parts: { readonly sealLine: HTMLElement; readonly aside: HTMLElement }): void {
    this.foot.trail.replaceChildren(parts.sealLine);
    this.aside.replaceChildren(parts.aside);
  }

  /** Show `view` (read only) in the editor's place; null gives the editor back. */
  compare(view: HTMLElement | null): void {
    if (view) this.board.hide();
    this.#sheet.compare(view);
  }

  /** Whether a seal is shown in the editor's place. */
  get comparing(): boolean {
    return this.#sheet.comparing;
  }

  show(note: PageNote): void {
    this.board.hide();
    const { text } = note.doc;
    this.#sheet.show(note.crumbs, note.title, text);
    this.editor.show(note.doc, note.loadImage);
    this.notice(null);
    this.state('saved');
    this.words.show(text);
    this.tags.show(text);
  }

  showNothing(): void {
    // The note gone (closed, trashed, gone from disk) with the keyboard in it: the page takes it.
    const had = this.#sheet.nothing();
    this.editor.release();
    this.words.clear();
    this.tags.clear();
    this.state('saved');
    if (had && !this.board.shown) this.#sheet.empty.focus();
  }

  /** The note read again from disk: its document has the new text already (../vault/open-notes.ts). */
  reloaded(text: string): void {
    this.words.show(text);
    this.tags.show(text);
    this.#sheet.title.follow(text);
  }

  retitle(title: string, crumbs: string): void {
    this.#sheet.retitle(title, this.editor.text, crumbs);
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
    this.#sheet.notice(text);
  }

  state(state: SaveState): void {
    this.foot.state(state);
  }

  /**
   * The keyboard to the note (on a touch screen only when `typing`: else to the title, so the
   * phone's keyboard stays down); with none open, to the page itself, never to nowhere.
   */
  focus(typing = false): void {
    if (this.board.shown) this.board.focus();
    else if (!this.#sheet.hasNote) this.#sheet.empty.focus();
    else if (this.comparing) this.#sheet.focusCompared();
    else if (typing || !matchMedia('(hover: none)').matches) this.editor.focus();
    else if (!this.#sheet.title.element.hidden) this.#sheet.title.element.focus();
    else (document.activeElement as HTMLElement | null)?.blur(); // the title is the note's own heading
  }

  /**
   * Find in the note (Replace unfolded, for `replace`): only where its text is
   * on the page, not outline cards nor a seal compared in its place.
   */
  find(replace: boolean): void {
    if (this.writable) this.editor.find.open(replace);
  }

  /** Rename the note: its title becomes a field, the words chosen; Enter keeps them, Esc doesn't. */
  editTitle(): void {
    if (this.#sheet.hasNote) this.#sheet.title.edit();
  }
}
