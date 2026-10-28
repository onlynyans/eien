// The pages of a shown vault: the page pane (../page/page-pane.ts) and the
// pages lying in it, each of a kind (./page-side.ts): a note's, held in the
// window's open notes (./open-notes.ts) with seals of its own (../versions),
// or another kind given (an EPUB's, backlog #40). A file opens on a page of
// the kind that holds it, put in the place of one of another kind. The
// menu's commands, the pane's tools and the window-wide parts
// (./page-parts.ts) act on the active page.

import type { OutBridge } from '../../platform/bridge';
import { type SplitSpec, splitSpecOf } from '../chrome/splits';
import type { ShownNotes } from '../list/shown-notes';
import type { NoteSession } from '../notes/note-session';
import { PagePane } from '../page/page-pane';
import type { Written } from '../page/word-count';
import type { SettingsState } from '../settings/settings-state';
import { sealTargetOf } from '../versions/seal-target';
import type { Navigation } from './navigation';
import { isNote, type NoteSide, type NoteSideOf, noteKind } from './note-side';
import { OpenNotes } from './open-notes';
import { type PageParts, pageParts } from './page-parts';
import type { PageKindOf, Place, Side } from './page-side';

export { isNote, type NoteSide } from './note-side';
export type { Side } from './page-side';

export interface PagesOf extends Omit<NoteSideOf, 'wrote' | 'counted'> {
  /** The kinds of page besides a note's (an EPUB's; a test's stand-in): the first that holds a file shows it. */
  readonly kinds?: readonly PageKindOf[];
  readonly settings: SettingsState;
  /** Where Copy as HTML and the exports go. */
  readonly out: OutBridge;
  readonly nav: Navigation;
  /** A note changed under the window (its words kept as a copy): read the vault again. */
  refresh(): void;
  /** The pages changed (one opened beside, closed, swapped, another made active): the window draws them. */
  rearranged(): void;
}

const inside = (path: string, folder: string) => path === folder || path.startsWith(`${folder}/`);

/** How two pages are laid out, as `values` say (appearance.split, appearance.narrowPages). */
const specFor = (values: SettingsState['values']): SplitSpec =>
  splitSpecOf(values['appearance.split'], values['appearance.narrowPages'] === 'on');

export class Pages {
  readonly pane: PagePane;
  /** What the pages share, acting on the active one: counters, Copy as HTML, exports, outline cards. */
  readonly parts: PageParts;
  readonly #of: PagesOf;
  readonly #notes: OpenNotes;
  /** The kinds of page, a note's last: it holds whatever the others don't. */
  readonly #kinds: readonly PageKindOf[];
  /** Left to right: one page, or two while the window is split. */
  #sides: Side[] = [];
  #active: Side;
  readonly #caret = new Set<() => void>();
  readonly #stopSettings: () => void;

  constructor(of: PagesOf) {
    this.#of = of;
    this.#notes = new OpenNotes(of.vault, of.refresh);
    const notes = noteKind(
      {
        ...of,
        wrote: (added: number, when: Written) => this.parts.wrote(added, when),
        counted: () => this.parts.counted(),
      },
      this.#notes,
    );
    this.#kinds = [...(of.kinds ?? []), notes];
    this.#active = this.#make(notes);
    this.#sides = [this.#active];
    this.pane = new PagePane(of.area, this.#active.page, {
      activate: (page) => {
        const side = this.#sides.find((each) => each.page === page);
        if (side) this.activate(side, true);
      },
      swap: () => this.swap(),
    });
    this.parts = pageParts({
      ...of,
      pages: this,
      act: of.act,
    });
    // The pages as the settings say: the pane's zoom, the mode, and each page's own (#make's first).
    this.pane.showZoom(of.settings.values['page.zoom']);
    this.#stopSettings = of.settings.onChange((values, before) => {
      this.pane.showZoom(values['page.zoom']);
      if (before && specFor(values) !== specFor(before)) this.#place();
      for (const side of this.#sides) side.follow(values);
    });
  }

  /** The page the commands act on. */
  get active(): Side {
    return this.#active;
  }

  /** The page beside the active one, while the window is split. */
  get other(): Side | null {
    return this.#sides.find((side) => side !== this.#active) ?? null;
  }

  /** The active page when it holds a note: what a note's commands and parts act on. */
  get activeNote(): NoteSide | null {
    return isNote(this.#active) ? this.#active : null;
  }

  get sides(): readonly Side[] {
    return this.#sides;
  }

  get split(): boolean {
    return this.#sides.length === 2;
  }

  /** How two pages are laid out: the mode's spec, split or not. */
  get mode(): SplitSpec {
    return specFor(this.#of.settings.values);
  }

  notes(): ShownNotes {
    return { active: this.#active.path, other: this.other?.path ?? null };
  }

  /** Hear the active page's caret move, or its text change under it; returns a function to stop. */
  onCaret(listener: () => void): () => void {
    this.#caret.add(listener);
    return () => this.#caret.delete(listener);
  }

  /**
   * Show the file at `path` on the active page, or `beside` it: on a second
   * page, made for it, or, split already, the other page. Either way that
   * page is then the active one; one of another kind than `path`'s gives
   * its place to one of that kind.
   */
  async open(path: string, beside = false, place?: Place): Promise<void> {
    const kind = this.#kinds.find((each) => each.holds(path)) as PageKindOf;
    if (beside) {
      const other = this.other ?? this.#make(kind);
      if (!this.#sides.includes(other)) this.#sides = [...this.#sides, other];
      this.activate(other);
    }
    const had = this.#active.kind === kind.kind ? false : this.#replace(this.#active, kind);
    const side = this.#active;
    await side.open(path, place);
    this.pane.renamed();
    if (had && this.#active === side) side.page.focus();
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
    else if (this.#active.path) await this.open(this.#active.path, true);
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
    side.dispose();
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

  /** `path` went to the trash: the pages showing it, or a file in it, show nothing. */
  closed(path: string): void {
    for (const side of this.#sides) if (side.path && inside(side.path, path)) side.clear();
  }

  /** Hold still (true) or let go (false) the notes' pages showing `path`, or a note in it, while it moves. */
  freeze(path: string, frozen: boolean): void {
    for (const { path: shown, page } of this.#noteSides())
      if (shown && inside(shown, path)) page.editor.setLocked(frozen);
  }

  /**
   * Change the words of the note at `path` as Eien's own edit, through a
   * page showing it (as a seal's id is, ../versions), and save it: whether
   * that worked, or null when no page shows it.
   */
  async amendOpen(path: string, change: (text: string) => string): Promise<boolean | null> {
    const side = this.#noteSides().find((each) => each.path === path);
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
    for (const { page } of this.#noteSides()) page.words.flush();
  }

  /** Files changed on disk: open notes look again, and another device may have sealed one. */
  diskChanged(changed: ReadonlySet<string>): void {
    this.#notes.diskChanged(changed);
    for (const { versions } of this.#noteSides()) void versions.diskChanged(changed);
  }

  /** Another note open, or the vault read again: each page's seals, and what the pages share, see it. */
  sync(): void {
    for (const { versions } of this.#noteSides()) versions.sync();
    this.parts.sync();
  }

  stop(): void {
    this.#stopSettings();
    this.pane.stop();
    this.parts.stop();
    for (const { versions } of this.#noteSides()) versions.stop();
  }

  #place(): void {
    this.pane.place(
      this.#sides.map(({ page }) => page),
      this.#active.page,
      this.mode,
    );
    this.#of.rearranged();
  }

  #noteSides(): NoteSide[] {
    return this.#sides.filter(isNote);
  }

  /**
   * `old`'s place given to a page of `kind`, which goes back to what `old`
   * showed as its other; laid out before `old` lets go, so the pane swaps
   * its parts out first. Whether `old` had the keyboard.
   */
  #replace(old: Side, kind: PageKindOf): boolean {
    const had = old.page.element.contains(document.activeElement);
    const side = this.#make(kind, old.place ?? old.left);
    this.#sides = this.#sides.map((each) => (each === old ? side : each));
    if (this.#active === old) this.#active = side;
    this.#place();
    old.dispose();
    return had;
  }

  /** A page of `kind`, as the settings say; the active one when the writer goes into it. */
  #make(kind: PageKindOf, left: Place | null = null): Side {
    const side: Side = kind.make(
      {
        close: () => this.close(side),
        caret: () => {
          if (this.#active === side) for (const listener of this.#caret) listener();
        },
      },
      left,
    );
    // The writer in a page (a click, the keyboard): it's the active one.
    const entered = () => {
      if (this.#active !== side) this.activate(side);
    };
    side.page.element.addEventListener('focusin', entered);
    side.page.element.addEventListener('pointerdown', entered);
    side.follow(this.#of.settings.values);
    return side;
  }
}
