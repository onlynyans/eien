// A page's note: its hold on the note (./open-notes.ts: the window's one
// session and document for it, however many pages show it), and what the
// page shows of it.

import { baseName, parentOf, titleOf } from '../../core/paths';
import type { ImageLoader } from '../editor/widgets';
import type { NoteSession, SaveState } from '../notes/note-session';
import type { PageView } from '../page/page';
import type { NoteHolder, OpenEntry, OpenNotes } from './open-notes';

/** Where a note was left on its page: its caret (or what was chosen) and how far it was scrolled. */
export interface NotePlace {
  readonly path: string;
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
  /** The note this page showed before the one it shows now, and where it was left. */
  #left: NotePlace | null = null;
  #shown = 0;
  readonly #notes: OpenNotes;
  readonly #page: PageView;

  constructor(notes: OpenNotes, page: PageView) {
    this.#notes = notes;
    this.#page = page;
  }

  get session(): NoteSession | null {
    return this.#entry?.session ?? null;
  }

  get path(): string | null {
    return this.#entry?.session.path ?? null;
  }

  /** The note this page showed before this one, and where it was left in it (the phone's other note). */
  get left(): NotePlace | null {
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
  async open(path: string, place?: NotePlace): Promise<void> {
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
    if (place?.path === path) this.#return(place);
  }

  /** Where the page is in its note now. */
  #place(path: string): NotePlace {
    const { anchor, head } = this.#page.editor.view.state.selection.main;
    return { path, anchor, head, scroll: this.#page.scroll.scrollTop };
  }

  /** Back where the note was left: the caret where it was, scrolled as it was (or as near as the text allows). */
  #return(place: NotePlace): void {
    const { view } = this.#page.editor;
    const most = view.state.doc.length;
    view.dispatch({
      selection: { anchor: Math.min(place.anchor, most), head: Math.min(place.head, most) },
    });
    this.#page.scroll.scrollTop = place.scroll;
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
