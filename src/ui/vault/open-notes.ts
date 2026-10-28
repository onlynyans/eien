// The notes open in a window, one entry per note however many pages show it
// (the split's two sides can hold the same note): one session saves it, one
// document holds its text and undo history (../editor/note-doc.ts), and its
// images are read once. Two sessions for one note in one window would take
// each other's saves for another device's, and keep conflict copies of the
// window's own words. The last page to let a note go closes it.

import { parentOf } from '../../core/paths';
import type { VaultBridge } from '../../platform/bridge';
import { type NoteImages, noteImages } from '../editor/image-loader';
import { NoteDoc } from '../editor/note-doc';
import { NoteSession, type SaveState } from '../notes/note-session';
import { touches } from './disk-changes';

/** A page showing an open note: what the note's session says, told to each page. */
export interface NoteHolder {
  status(state: SaveState): void;
  /** Its text changed on disk and was read again: the document has it already. */
  reloaded(text: string): void;
  /** It changed elsewhere while it had unsaved words, which went to `copy`, now the open note. */
  movedToCopy(copy: string, from: string): void;
  /** It's gone from the disk: the page lets it go. */
  gone(): void;
  /** It was renamed or moved here: the page names it, and finds its images, there. */
  moved(): void;
}

/** An open note: its session, its document, and where its images come from. */
export class OpenEntry {
  readonly session: NoteSession;
  readonly doc: NoteDoc;
  images: NoteImages;
  readonly holders = new Set<NoteHolder>();
  /** The path it's kept under: the session's, until a move is followed. */
  key: string;
  /** The folder its images are read from: the note's, when it was opened or last moved. */
  imagesFolder: string;

  constructor(session: NoteSession, images: NoteImages) {
    this.session = session;
    this.doc = new NoteDoc(session.text);
    this.images = images;
    this.key = session.path;
    this.imagesFolder = parentOf(session.path);
  }
}

export class OpenNotes {
  /** Opened, by path. */
  readonly #open = new Map<string, OpenEntry>();
  /** Being read from disk, by path: a second page asking meanwhile waits for the same one. */
  readonly #opening = new Map<string, Promise<OpenEntry | null>>();
  readonly #vault: VaultBridge;
  /** A note changed under the window (its words kept as a copy): read the vault again. */
  readonly #changed: () => void;

  constructor(vault: VaultBridge, changed: () => void) {
    this.#vault = vault;
    this.#changed = changed;
  }

  /** The note at `path`, held by `holder`; null when there's no such note. */
  async take(path: string, holder: NoteHolder): Promise<OpenEntry | null> {
    const entry = this.#open.get(path) ?? (await this.#read(path));
    entry?.holders.add(holder);
    return entry;
  }

  /** `holder` lets `entry` go; with no page left holding it, the note is closed. */
  release(entry: OpenEntry, holder: NoteHolder): void {
    // Let go once: a page closed while its open was on its way lets go of the same note twice.
    if (!entry.holders.delete(holder) || entry.holders.size > 0) return;
    entry.session.close();
    entry.images.release();
    if (this.#open.get(entry.key) === entry) this.#open.delete(entry.key);
  }

  /** Every note open now. */
  sessions(): NoteSession[] {
    return [...this.#open.values()].map((entry) => entry.session);
  }

  /** The note open at `path`, if any page shows it. */
  session(path: string): NoteSession | null {
    return this.#open.get(path)?.session ?? null;
  }

  /** Files changed on disk: each open note they touch looks at its file again (spec §3). */
  diskChanged(changed: ReadonlySet<string>): void {
    for (const { session } of this.#open.values())
      if (touches(session.path, changed)) void session.diskChanged();
  }

  /**
   * Notes the organizer moved or renamed (their sessions carry on at the new
   * path): each is kept under it, reads its images there, and its pages are told.
   */
  followMoves(): void {
    for (const entry of [...this.#open.values()]) {
      const path = entry.session.path;
      if (entry.key === path) continue;
      this.#open.delete(entry.key);
      entry.key = path;
      this.#open.set(path, entry);
      if (entry.imagesFolder !== parentOf(path)) {
        entry.images.release();
        entry.images = this.#imagesFor(path);
        entry.imagesFolder = parentOf(path);
      }
      for (const holder of entry.holders) holder.moved();
    }
  }

  /** Save whatever is unsaved, in every open note. */
  async flush(): Promise<void> {
    await Promise.all(this.sessions().map((session) => session.flush()));
  }

  #read(path: string): Promise<OpenEntry | null> {
    const reading = this.#opening.get(path);
    if (reading) return reading;
    const read = this.#open1(path).finally(() => this.#opening.delete(path));
    this.#opening.set(path, read);
    return read;
  }

  async #open1(path: string): Promise<OpenEntry | null> {
    // Its pages, told once the entry exists (no event comes before the session is made).
    let entry: OpenEntry | null = null;
    const each = (tell: (holder: NoteHolder) => void) => {
      for (const holder of entry?.holders ?? []) tell(holder);
    };
    const session = await NoteSession.open(this.#vault, path, {
      status: (state) => each((holder) => holder.status(state)),
      replaced: (text) => {
        entry?.doc.replace(text); // once, for every view of it
        each((holder) => holder.reloaded(text));
      },
      movedToCopy: (copy, from) => {
        this.followMoves(); // the session carries on at the copy: kept under it, its pages renamed
        each((holder) => holder.movedToCopy(copy, from));
        this.#changed();
      },
      gone: () => each((holder) => holder.gone()),
    });
    if (!session) return null;
    entry = new OpenEntry(session, this.#imagesFor(path));
    this.#open.set(path, entry);
    return entry;
  }

  #imagesFor(path: string): NoteImages {
    return noteImages(parentOf(path), (file) => this.#vault.readBytes(file));
  }
}
