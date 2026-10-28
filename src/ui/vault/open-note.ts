// A page's note: its hold on the note (./open-notes.ts: the window's one
// session and document for it, however many pages show it), and what the
// page shows of it.

import { baseName, parentOf, titleOf } from '../../core/paths';
import type { ImageLoader } from '../editor/widgets';
import type { NoteSession, SaveState } from '../notes/note-session';
import type { PageView } from '../page/page';
import type { NoteHolder, OpenEntry, OpenNotes } from './open-notes';
import type { Place } from './page-side';

/** Where a note was left on its page: its caret (or what was chosen) and how far it was scrolled. */
export interface NotePlace extends Place {
  readonly anchor: number;
  readonly head: number;
  readonly scroll: number;
}

/** The folders above a note, as the page shows them: "Fic / A Mended Scarf". */
export const crumbsOf = (path: string): string =>
  parentOf(path).split('/').filter(Boolean).join(' / ');

export class OpenNote implements NoteHolder {
  #entry: OpenEntry | null = null;
  /** The images the page's editor reads from: changed when the note moves to another folder. */
  #loader: ImageLoader | null = null;
  /** Each open asked for: one that finishes after a later one lets its note go. */
  #turn = 0;
  /** What this page showed before the note it shows now, and where it was left. */
  #left: Place | null;
  /**
   * How far the page was last scrolled, kept as it scrolls: a page out of sight (a phone's,
   * gone back to the list) reads 0, so its place is taken from here, not from the page then.
   */
  #scrolled = 0;
  #shown = 0;
  readonly #notes: OpenNotes;
  readonly #page: PageView;

  /** `left`: what the page showed before, when it held something else (./pages.ts). */
  constructor(notes: OpenNotes, page: PageView, left: Place | null = null) {
    this.#notes = notes;
    this.#page = page;
    this.#left = left;
    page.scroll.addEventListener(
      'scroll',
      () => {
        this.#scrolled = page.scroll.scrollTop;
      },
      { passive: true },
    );
  }

  get session(): NoteSession | null {
    return this.#entry?.session ?? null;
  }

  get path(): string | null {
    return this.#entry?.session.path ?? null;
  }

  /** Where the page is in its note now, or null with none open. */
  get place(): NotePlace | null {
    const { path } = this;
    return path ? this.#place(path) : null;
  }

  /** What this page showed before this note, and where it was left in it (the phone's other note). */
  get left(): Place | null {
    return this.#left;
  }

  /**
   * How many times a note (or nothing) was put on the page: each is afresh,
   * the same note opened again too, so Compare goes back to the draft.
   */
  get shown(): number {
    return this.#shown;
  }

  /** Open the note at `path`, once the one open now has saved; at `place`, where it was left there. */
  async open(path: string, place?: Place): Promise<void> {
    const turn = ++this.#turn;
    await this.#entry?.session.flush();
    const entry = await this.#notes.take(path, this);
    const before = this.#entry;
    if (turn !== this.#turn) {
      if (entry && entry !== before) this.#notes.release(entry, this);
      return;
    }
    if (before && before !== entry) {
      this.#left = this.#place(before.session.path);
      this.#notes.release(before, this);
    }
    this.#entry = entry;
    this.#shown++;
    if (!entry) return this.#page.showNothing();
    this.#loader = entry.images.load;
    this.#page.show({
      crumbs: crumbsOf(path),
      title: entry.session.title,
      doc: entry.doc,
      loadImage: entry.images.load,
    });
    if (place?.path === path && isNotePlace(place)) this.#return(place);
  }

  /** Where the page is in its note now. */
  #place(path: string): NotePlace {
    const { anchor, head } = this.#page.editor.view.state.selection.main;
    return { path, name: titleOf(baseName(path)), anchor, head, scroll: this.#scrolled };
  }

  /** Back where the note was left: the caret where it was, scrolled as it was (or as near as the text allows). */
  #return(place: NotePlace): void {
    const { view } = this.#page.editor;
    const most = view.state.doc.length;
    view.dispatch({
      selection: { anchor: Math.min(place.anchor, most), head: Math.min(place.head, most) },
    });
    const { scroll } = this.#page;
    scroll.scrollTop = place.scroll;
    // Again once the editor has measured its lines: before, the page may not reach so far down.
    requestAnimationFrame(() => {
      scroll.scrollTop = place.scroll;
    });
  }

  /**
   * The page closed: its words saved first (a session let go by its last page saves
   * nothing more), then the note let go. Nothing opens on it after.
   */
  async leave(): Promise<void> {
    this.#turn++;
    const entry = this.#entry;
    this.#entry = null;
    if (!entry) return;
    try {
      await entry.session.flush();
    } finally {
      this.#notes.release(entry, this);
    }
  }

  /** Nothing open: the note's gone (deleted elsewhere, or sent to the trash here). */
  close(): void {
    this.#turn++;
    if (this.#entry) this.#notes.release(this.#entry, this);
    this.#entry = null;
    this.#loader = null;
    this.#shown++;
    this.#page.showNothing();
  }

  status(state: SaveState): void {
    this.#page.state(state);
  }

  reloaded(text: string): void {
    this.#page.reloaded(text);
  }

  movedToCopy(copy: string, from: string): void {
    this.#page.notice(
      `“${titleOf(baseName(from))}” changed elsewhere. Your version is kept beside it as “${titleOf(baseName(copy))}”.`,
    );
  }

  gone(): void {
    this.close();
  }

  moved(): void {
    const entry = this.#entry;
    if (!entry) return;
    const path = entry.session.path;
    this.#page.retitle(titleOf(baseName(path)), crumbsOf(path));
    if (this.#loader === entry.images.load) return;
    this.#loader = entry.images.load;
    this.#page.editor.setImageLoader(entry.images.load);
  }
}

/** A place a note's page keeps: the place opened at, if it's in a note, is put back. */
const isNotePlace = (place: Place): place is NotePlace => 'anchor' in place;
