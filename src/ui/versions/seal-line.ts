// The seals' words outside the panel: the colophon's "▪ Sealed 2h ago" (or
// "Not sealed yet", or a word for a moment: "Nothing new to seal"), whose
// small seal presses in when the note is sealed.

import { h } from '../dom';
import { sealedWhen } from './seal-time';

/** How long a word in the colophon stays ("Nothing new to seal"). */
const FLASH_MS = 4000;

export type CompareMode = 'draft' | 'changes' | 'sealed';

/** What Compare's tooltip adds to its name: Compare · Changes, Compare · Sealed. */
export const COMPARE_WORD: Record<CompareMode, string> = {
  draft: '',
  changes: 'Changes',
  sealed: 'Sealed',
};

export class SealLine {
  readonly line = h('span', { class: 'seal-line', attrs: { role: 'status' } });
  #flash: { text: string; until: number } | null = null;
  /** What was last drawn, to draw it again when a word's time is up. */
  #last: { open: boolean; latest: number | null } = { open: false, latest: null };

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
  draw(open: boolean, latest: number | null): void {
    this.#last = { open, latest };
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
  }

  #redraw(): void {
    this.draw(this.#last.open, this.#last.latest);
  }
}
