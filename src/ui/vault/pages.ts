// The pages of a shown vault: the page pane (../page/page-pane.ts) and the
// pages lying in it, each of a kind (./page-side.ts): a note's, held in the
// window's open notes (./open-notes.ts) with seals of its own (../versions),
// or another kind given (an EPUB's, backlog #40). A file opens on a page of
// the kind that holds it, put in the place of one of another kind. The
// menu's commands, the pane's tools and the window-wide parts
// (./page-parts.ts) act on the active page. This is their arrangement; what
// a kind keeps up over its pages is the kind's (`PageKindOf`), and what the
// window asks of notes alone is ./note-pages.ts's.

import { isInside } from '../../core/paths';
import type { OutBridge } from '../../platform/bridge';
import { type SplitSpec, splitSpecOf, twoAtAnyWidth } from '../chrome/splits';
import type { ShownNotes } from '../list/shown-notes';
import { PagePane } from '../page/page-pane';
import type { Written } from '../page/word-count';
import type { SettingsState } from '../settings/settings-state';
import type { Navigation } from './navigation';
import { NotePages, noteKind } from './note-pages';
import { isNote, type NoteSide, type NoteSideOf } from './note-side';
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

/** How two pages are laid out, as `values` say (appearance.split, appearance.narrowPages). */
const specFor = (values: SettingsState['values']): SplitSpec =>
  splitSpecOf(values['appearance.split'], twoAtAnyWidth(values));

export class Pages {
  readonly pane: PagePane;
  /** What the pages share, acting on the active one: counters, Copy as HTML, exports, outline cards. */
  readonly parts: PageParts;
  /** What the window asks of the notes on the pages alone (the organizer, the counters). */
  readonly notes: NotePages;
  readonly #of: PagesOf;
  /** The kinds of page, a note's last: it holds whatever the others don't. */
  readonly #kinds: readonly PageKindOf[];
  /** Left to right: one page, or two while the window is split. */
  #sides: Side[] = [];
  #active: Side;
  readonly #caret = new Set<() => void>();
  readonly #stopSettings: () => void;

  constructor(of: PagesOf) {
    this.#of = of;
    const open = new OpenNotes(of.vault, of.refresh);
    this.notes = new NotePages(open, () => this.#sides);
    const note = noteKind(
      {
        ...of,
        wrote: (added: number, when: Written) => this.parts.wrote(added, when),
        counted: () => this.parts.counted(),
      },
      open,
    );
    this.#kinds = [...(of.kinds ?? []), note];
    this.#active = this.#make(note);
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

  shown(): ShownNotes {
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

  /** `path` went to the trash: the pages showing it, or a file in it, show nothing. */
  closed(path: string): void {
    for (const side of this.#sides) if (side.path && isInside(side.path, path)) side.clear();
  }

  /** Save whatever is unsaved, and count what was just written (today's words) without a pause. */
  async flush(): Promise<void> {
    // At once, each kind: one kind's save never waits for another's, nor a failure
    // in one cuts short the wait for the rest (a quit waits for them all).
    const settled = await Promise.allSettled(
      this.#kinds.map((kind) => kind.flush(this.#sidesOf(kind))),
    );
    const failed = settled.find((each) => each.status === 'rejected');
    if (failed) throw failed.reason;
  }

  /** Files changed on disk: what each page shows looks again (an open note; a seal another device made). */
  diskChanged(changed: ReadonlySet<string>): void {
    for (const kind of this.#kinds) kind.diskChanged(changed, this.#sidesOf(kind));
  }

  /** Files this window moved or renamed: kept, named and imaged where they are now. */
  followMoves(): void {
    for (const kind of this.#kinds) kind.followMoves(this.#sidesOf(kind));
    this.pane.renamed();
  }

  /** Another file open, or the vault read again: each page, and what the pages share, see it. */
  sync(): void {
    for (const kind of this.#kinds) kind.sync(this.#sidesOf(kind));
    this.parts.sync();
  }

  stop(): void {
    this.#stopSettings();
    this.pane.stop();
    this.parts.stop();
    for (const kind of this.#kinds) kind.stop(this.#sidesOf(kind));
  }

  #place(): void {
    this.pane.place(
      this.#sides.map(({ page }) => page),
      this.#active.page,
      this.mode,
    );
    this.#of.rearranged();
  }

  /** The pages of `kind`: one kind per `PageKind` (a stand-in's and the EPUB's are never both given). */
  #sidesOf(kind: PageKindOf): Side[] {
    return this.#sides.filter((side) => side.kind === kind.kind);
  }

  /**
   * `old`'s place given to a page of `kind`, which goes back to what `old`
   * showed as its other; laid out before `old` lets go, so the pane swaps
   * its parts out first. Whether `old` had the keyboard.
   */
  #replace(old: Side, kind: PageKindOf): boolean {
    const { element, aside, under } = old.page; // its panel and table bar lie outside it
    const had = [element, aside, under].some((part) => part.contains(document.activeElement));
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
