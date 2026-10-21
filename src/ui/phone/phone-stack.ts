// A phone shows one pane at a time (spec §10): the tree, then a folder's
// notes, then the page. Choosing goes forward; back (the bar's word, or
// Android's back gesture) goes the other way. The page's tools are the
// layout's (../chrome): in the bar's `controls` (A's), or at the page's foot. A window narrower than any
// desktop window can be is a phone's, whatever the system: an upright phone
// (430 px at most), not a tablet; and the phone's page in tests.

import { h, wordButton } from '../dom';

export type PhonePane = 'sidebar' | 'list' | 'page';

const ORDER: readonly PhonePane[] = ['sidebar', 'list', 'page'];

/** Narrower than any desktop window (app/electron/window.ts: 640, less a Windows frame's 16). */
export const NARROW = '(max-width: 599.98px)';

export interface PhoneParts {
  readonly shell: HTMLElement;
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
  readonly #onNarrow = () => {
    this.#apply();
    this.#parts.changed();
    const at = document.activeElement;
    const gone =
      !(at instanceof HTMLElement) ||
      at === document.body ||
      at.closest('[inert]') !== null ||
      !at.checkVisibility({ visibilityProperty: true });
    if (gone) this.#parts.lost();
  };
  #shown: PhonePane = 'list';

  constructor(parts: PhoneParts) {
    this.#parts = parts;
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

  /** Whether the window is a phone's: one pane at a time. */
  get phone(): boolean {
    return this.#narrow.matches;
  }

  /** The pane in sight on a phone; null on a wider window, where all are. */
  get shown(): PhonePane | null {
    return this.phone ? this.#shown : null;
  }

  /** Bring `pane` into sight (on a phone) with the keyboard in it. */
  show(pane: PhonePane): void {
    if (pane === this.#shown) return;
    if (this.#shown === 'page') this.#parts.leavingPage();
    this.#shown = pane;
    this.#apply();
    if (!this.phone) return;
    this.#parts.changed();
    this.#parts.focus(pane);
  }

  /** One pane back; false when there's none (the tree) or the window isn't a phone's. */
  back(): boolean {
    const at = ORDER.indexOf(this.#shown);
    const before = ORDER[at - 1];
    if (!this.phone || !before) return false;
    this.show(before);
    return true;
  }

  stop(): void {
    this.#narrow.removeEventListener('change', this.#onNarrow);
  }

  #apply(): void {
    const { shell } = this.#parts;
    shell.toggleAttribute('data-phone', this.phone);
    shell.dataset.shown = this.#shown;
    const before = ORDER[ORDER.indexOf(this.#shown) - 1];
    this.bar.hidden = !this.phone || !before;
    this.#back.textContent = before ? `‹ ${this.#parts.backName(before)}` : '';
  }

  /** The back word, named anew (the list's heading changed). */
  rename(): void {
    this.#apply();
  }
}
