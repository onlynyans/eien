// The pages of a shown vault: the page pane (../page/page-pane.ts) and the
// pages lying in it, each showing a note held in the window's open notes
// (./open-notes.ts) and with seals of its own (../versions). The menu's
// commands, the pane's tools and the window-wide parts (./page-parts.ts) act
// on the active page.

import type { VaultBridge } from '../../platform/bridge';
import type { NoteSession } from '../notes/note-session';
import type { PageView } from '../page/page';
import { PagePane } from '../page/page-pane';
import type { Written } from '../page/word-count';
import type { SettingsState } from '../settings/settings-state';
import { sealTargetOf } from '../versions/seal-target';
import { VersionsUI } from '../versions/versions-ui';
import { type NotePageParts, notePage } from './note-page';
import { OpenNote } from './open-note';
import { OpenNotes } from './open-notes';
import type { OrganizeContext } from './organize';

/** A page, the note it shows, and that note's seals. */
export interface Side {
  readonly page: PageView;
  readonly note: OpenNote;
  readonly versions: VersionsUI;
}

/** The notes the pages show: the active page's, and the other's while split. */
export interface ShownNotes {
  readonly active: string | null;
  readonly other: string | null;
}

export interface PagesOf extends Omit<NotePageParts, 'note'> {
  /** The pane's element (the window's `main`). */
  readonly area: HTMLElement;
  readonly vault: VaultBridge;
  readonly settings: SettingsState;
  /** The Mac's keys, for the keys the versions panel names. */
  readonly mac: boolean;
  /** What a seal's controls show changed (Compare's state, the panel open). */
  changed(): void;
  /** Run a file operation after those under way, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): Promise<void>;
  /** A note changed under the window (its words kept as a copy): read the vault again. */
  refresh(): void;
  /** Words the writer added on a page, for today's tally and a sprint (../counters). */
  wrote(added: number, when: Written): void;
  /** A page's words were counted again: the book's total moves with them. */
  counted(): void;
}

const inside = (path: string, folder: string) => path === folder || path.startsWith(`${folder}/`);

export class Pages {
  readonly pane: PagePane;
  readonly #notes: OpenNotes;
  readonly #sides: Side[] = [];
  readonly #caret = new Set<() => void>();
  readonly #stopSettings: () => void;

  constructor(of: PagesOf) {
    this.#notes = new OpenNotes(of.vault, of.refresh);
    const first = this.#side(of);
    this.pane = new PagePane(of.area, first.page);
    this.#sides.push(first);
    // The pages as the settings say: the pane's zoom, and each editor's quotes, tools and marks.
    const follow = (values: SettingsState['values']) => {
      this.pane.showZoom(values['page.zoom']);
      for (const { page } of this.#sides) {
        page.editor.setQuotes(values['typography.quotes']);
        page.editor.setTools({
          focus: values['editor.focus'] === 'on',
          typewriter: values['editor.typewriter'] === 'on',
          spellcheck: values['editor.spellcheck'] === 'on',
        });
        page.editor.setMarks(values['editor.marks'] === 'on');
      }
    };
    follow(of.settings.values);
    this.#stopSettings = of.settings.onChange(follow);
  }

  /** The page the commands act on. */
  get active(): Side {
    return this.#sides[0] as Side;
  }

  get sides(): readonly Side[] {
    return this.#sides;
  }

  notes(): ShownNotes {
    return { active: this.active.note.path, other: null };
  }

  /** Hear the active page's caret move, or its text change under it; returns a function to stop. */
  onCaret(listener: () => void): () => void {
    this.#caret.add(listener);
    return () => this.#caret.delete(listener);
  }

  /** Show the note at `path` on the active page. */
  open(path: string): Promise<void> {
    return this.active.note.open(path);
  }

  /** Every note open, for the organizer: a move or the trash waits for its words. */
  sessions(): NoteSession[] {
    return this.#notes.sessions();
  }

  /** The note open at `path`, whichever page shows it. */
  session(path: string): NoteSession | null {
    return this.#notes.session(path);
  }

  /** `path` went to the trash: the pages showing it, or a note in it, show nothing. */
  closed(path: string): void {
    for (const { note } of this.#sides) if (note.path && inside(note.path, path)) note.close();
  }

  /** Hold still (true) or let go (false) the pages showing `path`, or a note in it, while it moves. */
  freeze(path: string, frozen: boolean): void {
    for (const { note, page } of this.#sides)
      if (note.path && inside(note.path, path)) page.editor.setLocked(frozen);
  }

  /**
   * Change the words of the note at `path` as Eien's own edit, through a
   * page showing it (as a seal's id is, ../versions), and save it: whether
   * that worked, or null when no page shows it.
   */
  async amendOpen(path: string, change: (text: string) => string): Promise<boolean | null> {
    const side = this.#sides.find(({ note }) => note.path === path);
    return side ? (sealTargetOf(side.note, side.page)?.amend(change, false) ?? null) : null;
  }

  /** Notes this window moved or renamed: kept, named and imaged where they are now. */
  followMoves(): void {
    this.#notes.followMoves();
  }

  /** Save whatever is unsaved, and count what was just written (today's words) without a pause. */
  async flush(): Promise<void> {
    this.flushWords();
    await this.#notes.flush();
  }

  /** Count what was just written on every page, now. */
  flushWords(): void {
    for (const { page } of this.#sides) page.words.flush();
  }

  /** Files changed on disk: open notes look again, and another device may have sealed one. */
  diskChanged(changed: ReadonlySet<string>): void {
    this.#notes.diskChanged(changed);
    for (const { versions } of this.#sides) void versions.diskChanged(changed);
  }

  /** Another note open, or the vault read again: each page's seals see it. */
  sync(): void {
    for (const { versions } of this.#sides) versions.sync();
  }

  stop(): void {
    this.#stopSettings();
    for (const { versions } of this.#sides) versions.stop();
  }

  /** A page, its note and its seals. */
  #side(of: PagesOf): Side {
    let note: OpenNote | null = null;
    const page = notePage(of.area, { ...of, note: () => note as OpenNote });
    note = new OpenNote(this.#notes, page);
    page.words.onWrote(of.wrote);
    page.words.onCounted(of.counted);
    page.onCaret(() => {
      if (this.active.page === page) for (const listener of this.#caret) listener();
    });
    const versions = new VersionsUI({
      page,
      note,
      vault: of.vault,
      notesWithId: (id) => of.state.notesWithId(id),
      mac: of.mac,
      tell: of.tell,
      serial: of.act,
      changed: of.changed,
    });
    return { page, note, versions };
  }
}

/** What the organizer asks of the pages (./organize.ts), which are made after it. */
export const pagesHeld = (
  pages: () => Pages,
): Pick<OrganizeContext, 'sessions' | 'closed' | 'freeze' | 'amendOpen'> => ({
  sessions: () => pages().sessions(),
  closed: (path) => pages().closed(path),
  freeze: (path, frozen) => pages().freeze(path, frozen),
  amendOpen: (path, change) => pages().amendOpen(path, change),
});
