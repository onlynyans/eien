// A phone shows one pane at a time (spec §10): the tree, then a folder's
// notes, then the page. Choosing goes forward; back (the bar's word, or
// Android's back gesture) goes the other way. A window narrower than any
// desktop window can be is a phone's, whatever the system: an upright phone
// (430 px at most), not a tablet; and the phone's page in tests.

import { h, wordButton } from '../dom';

export type PhonePane = 'sidebar' | 'list' | 'page';

const ORDER: readonly PhonePane[] = ['sidebar', 'list', 'page'];

/** Narrower than any desktop window (app/electron/window.ts: 640, less a Windows frame's 16). */
const NARROW = '(max-width: 599.98px)';

export interface PhoneParts {
  readonly shell: HTMLElement;
  /** What the bar's back names: where it goes. */
  backName(to: PhonePane): string;
  /** The ⋯ menu, under its button. */
  more(opener: HTMLElement): void;
  /** The keyboard to the pane now shown (never left in one gone from sight). */
  focus(pane: PhonePane): void;
  /** Phone or not, or the pane shown, changed: lay the panes out again. */
  changed(): void;
}

export class PhoneStack {
  /** Back, and the page's ⋯: over the pane shown, on a phone only. */
  readonly bar: HTMLElement;
  readonly #parts: PhoneParts;
  readonly #back: HTMLButtonElement;
  readonly #more: HTMLButtonElement;
  readonly #narrow = window.matchMedia(NARROW);
  readonly #onNarrow = () => {
    this.#apply();
    this.#parts.changed();
  };
  #shown: PhonePane = 'list';

  constructor(parts: PhoneParts) {
    this.#parts = parts;
    this.#back = wordButton('', () => this.back());
    this.#back.classList.add('phone-bar__back');
    this.#more = wordButton('⋯', () => parts.more(this.#more), { 'aria-label': 'More' });
    this.#more.classList.add('phone-bar__more');
    this.bar = h(
      'nav',
      { class: 'phone-bar', attrs: { 'aria-label': 'Back' } },
      this.#back,
      this.#more,
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
    this.#more.hidden = this.#shown !== 'page';
  }

  /** The back word, named anew (the list's heading changed). */
  rename(): void {
    this.#apply();
  }
}
