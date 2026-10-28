// One page of the pane, as the pages controller (./pages.ts) holds it,
// whatever it holds: a note (./note-side.ts), or an EPUB (backlog #40, not
// built yet; ../../../docs/page-kinds.md). The split, its pager, swap, the
// phone's other note and Wide screen's rooms carry a Side and never ask what
// it holds; what is a note's alone is reached through `isNote`.

import type { SettingValues } from '../../core/config';
import type { PageKind, PaneLeaf } from '../page/page-leaf';

/** Where a page was in what it showed: the phone's other note (⇄) goes back there. */
export interface Place {
  readonly path: string;
  /** What the page called it then (a note's title, from its file's name): the slip names it so. */
  readonly name: string;
}

/** A page, and what it shows. */
export interface Side {
  readonly kind: PageKind;
  readonly page: PaneLeaf;
  /** What it shows, or null with nothing open. */
  readonly path: string | null;
  /** Where the page is in it now, or null with nothing open. */
  readonly place: Place | null;
  /**
   * What the page showed before, and where it was left: the same object until
   * the page leaves another (../vault/phone-other.ts tells a new one by it).
   */
  readonly left: Place | null;
  /** Show the file at `path`, at `place` when that's where it was left; nothing once disposed. */
  open(path: string, place?: Place): Promise<void>;
  /** What it shows is gone (the trash, or deleted elsewhere): it shows nothing. */
  clear(): void;
  /** The settings as they are now. */
  follow(values: SettingValues): void;
  /** The page closed: what it holds saved and let go, so it leaves no view, timer or listener. */
  dispose(): void;
}

/** What a page tells its controller: its × pressed, its caret moved. */
export interface SideHooks {
  close(): void;
  caret(): void;
}

/** A kind of page: which files it shows, and a page of it made. */
export interface PageKindOf {
  readonly kind: PageKind;
  holds(path: string): boolean;
  /** A page of this kind; `left`, what the page in its place showed before (so ⇄ goes back to it). */
  make(hooks: SideHooks, left: Place | null): Side;
}
