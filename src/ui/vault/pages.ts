// The pages of a shown vault: the page pane (../page/page-pane.ts) and the
// pages lying in it, each showing a note held in the window's open notes
// (./open-notes.ts) and with seals of its own (../versions). The menu's
// commands, the pane's tools and the window-wide parts (./page-parts.ts) act
// on the active page.

import { SPLIT_SPECS, type SplitSpec } from '../chrome/splits';
import type { ShownNotes } from '../list/shown-notes';
import type { NoteSession } from '../notes/note-session';
import { PagePane } from '../page/page-pane';
import type { SettingsState } from '../settings/settings-state';
import { sealTargetOf } from '../versions/seal-target';
import { OpenNotes } from './open-notes';
import type { OrganizeContext } from './organize';
import { closeSide, followSettings, makeSide, type Side, type SideOf } from './page-side';

export type { Side } from './page-side';

export interface PagesOf extends SideOf {
  readonly settings: SettingsState;
  /** A note changed under the window (its words kept as a copy): read the vault again. */
  refresh(): void;
  /** The pages changed (one opened beside, closed, swapped, another made active): the window draws them. */
  rearranged(): void;
}

const inside = (path: string, folder: string) => path === folder || path.startsWith(`${folder}/`);

export class Pages {
  readonly pane: PagePane;
  readonly #of: PagesOf;
  readonly #notes: OpenNotes;
  /** Left to right: one page, or two while the window is split. */
  #sides: Side[] = [];
  #active: Side;
  readonly #caret = new Set<() => void>();
  readonly #stopSettings: () => void;

  constructor(of: PagesOf) {
    this.#of = of;
    this.#notes = new OpenNotes(of.vault, of.refresh);
    this.#active = this.#make();
    this.#sides = [this.#active];
    this.pane = new PagePane(of.area, this.#active.page, {
      activate: (page) => {
        const side = this.#sides.find((each) => each.page === page);
        if (side) this.activate(side, true);
      },
      swap: () => this.swap(),
    });
    // The pages as the settings say: the pane's zoom, and each editor's quotes, tools and marks.
    const follow = (values: SettingsState['values'], before?: SettingsState['values']) => {
      this.pane.showZoom(values['page.zoom']);
      if (before && values['appearance.split'] !== before['appearance.split']) this.#place();
      for (const { page } of this.#sides) followSettings(page, values);
    };
    follow(of.settings.values);
    this.#stopSettings = of.settings.onChange(follow);
  }

  /** The page the commands act on. */
  get active(): Side {
    return this.#active;
  }

  /** The page beside the active one, while the window is split. */
  get other(): Side | null {
    return this.#sides.find((side) => side !== this.#active) ?? null;
  }

  get sides(): readonly Side[] {
    return this.#sides;
  }

  get split(): boolean {
    return this.#sides.length === 2;
  }

  /** How two pages are laid out (appearance.split): the mode's spec, split or not. */
  get mode(): SplitSpec {
    return SPLIT_SPECS[this.#of.settings.values['appearance.split']];
  }

  notes(): ShownNotes {
    return { active: this.#active.note.path, other: this.other?.note.path ?? null };
  }

  /** Hear the active page's caret move, or its text change under it; returns a function to stop. */
  onCaret(listener: () => void): () => void {
    this.#caret.add(listener);
    return () => this.#caret.delete(listener);
  }

  /**
   * Show the note at `path` on the active page, or `beside` it: on a second
   * page, made for it, or, split already, the other page. Either way that
   * page is then the active one.
   */
  async open(path: string, beside = false): Promise<void> {
    if (beside) {
      const other = this.other ?? this.#make();
      if (!this.#sides.includes(other)) {
        this.#sides = [...this.#sides, other];
        followSettings(other.page, this.#of.settings.values);
      }
      this.activate(other);
    }
    await this.#active.note.open(path);
    this.pane.renamed();
  }

  /** Make `side` the active page; `focus`, with the keyboard in it. */
  activate(side: Side, focus = false): void {
    if (side !== this.#active) {
      this.#active = side;
      this.#place();
    }
    if (focus) side.page.focus();
  }

  /** ⌘D: the active page's note beside itself, or, split, the other page closed. */
  async toggle(): Promise<void> {
    const other = this.other;
    if (other) this.close(other);
    else if (this.#active.note.path) await this.open(this.#active.note.path, true);
  }

  /** ⌘3 in a page: the keyboard to the other one. */
  focusOther(): void {
    const other = this.other;
    if (other) this.activate(other, true);
  }

  /**
   * Close `side` (its ×, ⌘W, ⌘D): never the last page, and never its note,
   * which is as it was. Whether it closed.
   */
  close(side: Side): boolean {
    if (!this.split || !this.#sides.includes(side)) return false;
    const had = side.page.element.contains(document.activeElement);
    this.#sides = this.#sides.filter((each) => each !== side);
    const left = this.#sides[0] as Side;
    this.#active = left;
    this.#place();
    closeSide(side);
    if (had) left.page.focus();
    return true;
  }

  /** ⇄: the two pages trade places; the active one stays active. */
  swap(): void {
    if (!this.split) return;
    this.#sides = [...this.#sides].reverse();
    this.#place();
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
    this.pane.renamed();
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
    this.pane.stop();
    for (const { versions } of this.#sides) versions.stop();
  }

  #place(): void {
    this.pane.place(
      this.#sides.map(({ page }) => page),
      this.#active.page,
      this.mode,
    );
    this.#of.rearranged();
  }

  /** A page, its note and its seals; the active one when the writer goes into it. */
  #make(): Side {
    const side: Side = makeSide(this.#of, this.#notes, {
      close: () => this.close(side),
      caret: () => {
        if (this.#active === side) for (const listener of this.#caret) listener();
      },
      entered: () => {
        if (this.#active !== side) this.activate(side);
      },
    });
    return side;
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
