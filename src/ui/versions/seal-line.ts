// The seals' words outside the panel: the colophon's "▪ Sealed 2h ago" (or
// "Not sealed yet", or a word for a moment: "Nothing new to seal"), whose
// small seal presses in when the note is sealed; and the bar's COMPARE,
// which says what it shows: COMPARE · CHANGES, COMPARE · SEALED.

import { h, wordButton } from '../dom';
import { sealedWhen } from './seal-time';

/** How long a word in the colophon stays ("Nothing new to seal"). */
const FLASH_MS = 4000;

export type CompareMode = 'draft' | 'changes' | 'sealed';

const MODE_WORD: Record<CompareMode, string> = { draft: '', changes: 'Changes', sealed: 'Sealed' };

export class SealLine {
  readonly line = h('span', { class: 'seal-line', attrs: { role: 'status' } });
  readonly compareButton: HTMLButtonElement;
  #flash: { text: string; until: number } | null = null;
  /** What was last drawn, to draw it again when a word's time is up. */
  #last: { open: boolean; latest: number | null; mode: CompareMode } = {
    open: false,
    latest: null,
    mode: 'draft',
  };

  constructor(compare: () => void, compareKeys: string) {
    this.compareButton = wordButton('Compare', compare, { 'aria-keyshortcuts': compareKeys });
  }

  /** A word in the colophon for a moment. */
  say(text: string): void {
    this.#flash = { text, until: Date.now() + FLASH_MS };
    this.#redraw();
    setTimeout(() => this.#redraw(), FLASH_MS + 50);
  }

  /** The colophon's seal presses in, as a seal does. */
  stamp(): void {
    this.#flash = null;
    this.#redraw();
    const mark = this.line.querySelector<HTMLElement>('.seal');
    mark?.classList.remove('is-stamping');
    void mark?.offsetWidth; // so the animation runs again
    mark?.classList.add('is-stamping');
  }

  /** `open`: a note is on the page; `latest`: when it was last sealed, or null. */
  draw(open: boolean, latest: number | null, mode: CompareMode): void {
    this.#last = { open, latest, mode };
    const now = Date.now();
    const flash = this.#flash && now < this.#flash.until ? this.#flash.text : null;
    const said =
      flash ?? (latest === null ? 'Not sealed yet' : `Sealed ${sealedWhen(latest, now)}`);
    this.line.replaceChildren(
      ...(open
        ? [
            h('span', {
              class: 'seal seal--small',
              attrs: { 'aria-hidden': 'true', hidden: latest === null },
            }),
            said,
          ]
        : []),
    );
    const button = this.compareButton;
    const word = MODE_WORD[mode];
    button.replaceChildren(
      'Compare',
      ...(word ? [h('span', { class: 'compare-state', text: ` · ${word}` })] : []),
    );
    button.setAttribute('aria-pressed', String(mode !== 'draft'));
    button.disabled = !open || latest === null;
    button.title = button.disabled
      ? 'Not sealed yet'
      : 'Compare with the last seal: Changes, then Sealed, then Draft';
  }

  #redraw(): void {
    this.draw(this.#last.open, this.#last.latest, this.#last.mode);
  }
}
