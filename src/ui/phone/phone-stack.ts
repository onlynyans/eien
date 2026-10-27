// A phone shows one pane at a time (spec §10): the tree, then a folder's
// notes, then the page. Choosing goes forward; back (the bar's word, or
// Android's back gesture) goes the other way. The page's tools are the
// layout's (../chrome): in the bar's `controls` (A's), or at the page's foot. A window narrower than any
// desktop window can be is a phone's, whatever the system: an upright phone
// (430 px at most), not a tablet; and the phone's page in tests. Wider, the
// room (./room.ts) says how: the desktop's panes, one at a time still, the
// pane before kept in sight beside, or the notes over two pages.

import { h, wordButton } from '../dom';
import {
  backTo,
  inSight,
  NARROW,
  onePane,
  PHONE_ORDER,
  type PhonePane,
  type Room,
  twoPages,
} from './room';

export interface PhoneParts {
  readonly shell: HTMLElement;
  /** The room this window uses, `narrow` or not (./room.ts). */
  room(narrow: boolean): Room;
  /** What the bar's back names: where it goes. */
  backName(to: PhonePane): string;
  /** The keyboard to the pane now shown (never left in one gone from sight). */
  focus(pane: PhonePane): void;
  /** The page goes from sight: what lay over it closes, so nothing waits there unseen. */
  leavingPage(): void;
  /** The keyboard was on something gone from sight as the window turned: give it a place. */
  lost(): void;
  /** Phone or not, or the pane shown, changed: lay the panes out again. */
  changed(): void;
}

export class PhoneStack {
  /** Back, and a layout's tools for the page: over the pane shown, on a phone only. */
  readonly bar: HTMLElement;
  /** In the bar, after back: where a layout draws the page's tools (A's top bar). */
  readonly controls = h('div', { class: 'phone-bar__controls' });
  readonly #parts: PhoneParts;
  readonly #back: HTMLButtonElement;
  readonly #narrow = window.matchMedia(NARROW);
  readonly #onNarrow = () => this.roomChanged();
  #shown: PhonePane = 'list';
  #room: Room;

  constructor(parts: PhoneParts) {
    this.#parts = parts;
    this.#room = parts.room(this.#narrow.matches);
    this.#back = wordButton('', () => this.back());
    this.#back.classList.add('phone-bar__back');
    this.bar = h(
      'nav',
      { class: 'phone-bar', attrs: { 'aria-label': 'Back' } },
      this.#back,
      this.controls,
    );
    this.#narrow.addEventListener('change', this.#onNarrow);
    this.#apply();
  }

  /** The room this window uses now. */
  get room(): Room {
    return this.#room;
  }

  /** Whether the window goes the phone's way: one pane, or a step, at a time. */
  get phone(): boolean {
    return onePane(this.#room);
  }

  /** Whether a second page may open beside the first. */
  get splits(): boolean {
    return twoPages(this.#room);
  }

  /** The pane the writer is at, the phone's way; null with the desktop's panes, where all are. */
  get shown(): PhonePane | null {
    return this.phone ? this.#shown : null;
  }

  /** Whether `pane` is in sight (every one with the desktop's panes; ./room.ts). */
  inSight(pane: PhonePane): boolean {
    return inSight(this.#room, this.#shown, pane);
  }

  /** Bring `pane` into sight (the phone's way) with the keyboard in it. */
  show(pane: PhonePane): void {
    if (pane === this.#shown) return;
    if (this.#leaves(this.#room, pane)) this.#parts.leavingPage();
    this.#shown = pane;
    this.#apply();
    if (!this.phone) return;
    this.#parts.changed();
    this.#parts.focus(pane);
  }

  /** One pane back; false when there's none (the contents in sight) or the window has the desktop's panes. */
  back(): boolean {
    const before = backTo(this.#room, this.#shown);
    if (!this.phone || !before) return false;
    this.show(before);
    return true;
  }

  /** The room may have changed (the window turned or unfolded, or Wide screen was set): lay it out again. */
  roomChanged(): void {
    const room = this.#parts.room(this.#narrow.matches);
    if (room === this.#room) return;
    if (this.#leaves(room, this.#shown)) this.#parts.leavingPage();
    this.#room = room;
    this.#apply();
    this.#parts.changed();
    const at = document.activeElement;
    const gone =
      !(at instanceof HTMLElement) ||
      at === document.body ||
      at.closest('[inert]') !== null ||
      !at.checkVisibility({ visibilityProperty: true });
    if (gone) this.#parts.lost();
  }

  stop(): void {
    this.#narrow.removeEventListener('change', this.#onNarrow);
  }

  /** Whether the page, in sight now, goes from sight in `room` with `shown` the pane at. */
  #leaves(room: Room, shown: PhonePane): boolean {
    return this.inSight('page') && !inSight(room, shown, 'page');
  }

  #apply(): void {
    const { shell } = this.#parts;
    const before = backTo(this.#room, this.#shown);
    shell.toggleAttribute('data-phone', this.phone);
    shell.dataset.room = this.#room;
    shell.dataset.shown = this.#shown;
    shell.dataset.sight = PHONE_ORDER.filter((pane) => this.inSight(pane)).join(' ');
    // Two pages: the page under the notes is only to be seen until they're put away.
    const covered = this.#room === 'pages' && this.#shown !== 'page';
    shell.querySelector(':scope > .page')?.toggleAttribute('inert', covered);
    this.bar.hidden = !this.phone || !before;
    // Back names what it brings into sight: side by side, the contents, beside the notes in sight.
    const comes =
      before &&
      PHONE_ORDER.find((pane) => inSight(this.#room, before, pane) && !this.inSight(pane));
    this.#back.textContent = before ? `‹ ${this.#parts.backName(comes ?? before)}` : '';
  }

  /** The back word, named anew (the list's heading changed). */
  rename(): void {
    this.#apply();
  }
}
