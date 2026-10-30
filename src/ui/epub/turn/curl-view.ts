// The curl drawn (#40, Phase 3): copies of the live page laid over the
// sheet, each clipped and moved where core/epub's frame says (curl-frame.ts).
// Forward, the page you leave curls away over the next; back, the page
// before curls back over the one you were on. In this order, whatever the
// page's own rules would stack: the page beneath, the roll's shadow on it,
// what stays flat, the roll's front, then what comes back over it (its back
// half and what lies on top), which casts the lifted paper's one shadow.

import { CURL_STRIPS, type CurlFrame, type Light, type Polygon } from '../../../core/epub';
import { h } from '../../dom';
import { layOver, pageCopy } from './page-copy';
import { CURL_INK } from './turn-tokens';

/** A polygon as a clip-path; an empty one hides what it clips. */
export const clipOf = (polygon: Polygon): string =>
  polygon.length > 2
    ? `polygon(${polygon.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(', ')})`
    : 'polygon(0 0, 0 0, 0 0)';

/** A light as a gradient in `ink`, each stop the ink at its strength. */
export const gradientOf = (light: Light, ink: string): string =>
  `linear-gradient(${light.angle.toFixed(2)}deg, ${light.stops
    .map(
      (stop) =>
        `color-mix(in srgb, ${ink} ${(stop.strength * 100).toFixed(1)}%, transparent) ${stop.at.toFixed(1)}px`,
    )
    .join(', ')})`;

const part = (name: string) => h('div', { class: `turn-curl__${name}` });

interface Strip {
  readonly element: HTMLElement;
  readonly tone: HTMLElement;
  readonly glint: HTMLElement | null;
}

export class CurlView {
  readonly element = h('div', { class: 'turn-curl', attrs: { 'aria-hidden': 'true' } });
  readonly #to: HTMLElement;
  readonly #cast = part('wash');
  readonly #front: HTMLElement;
  readonly #strips: readonly Strip[];
  readonly #back: HTMLElement;
  readonly #light = part('wash');
  readonly #flap = part('flap');

  /** Over `to`, the sheet now; `leaving`, a copy of the one before the turn. */
  constructor(leaving: HTMLElement, to: HTMLElement, way: 1 | -1, words: string) {
    this.#to = to;
    const moving = way > 0 ? leaving : pageCopy(to, words);
    if (way < 0) {
      leaving.classList.add('turn-curl__page', 'turn-curl__beneath');
      this.element.append(leaving);
      to.style.visibility = 'hidden';
    }
    const piece = (...names: string[]) => {
      const copy = moving.cloneNode(true) as HTMLElement;
      copy.classList.add('turn-curl__page', ...names.map((name) => `turn-curl__${name}`));
      return copy;
    };
    this.#front = moving;
    moving.classList.add('turn-curl__page');
    this.#strips = Array.from({ length: CURL_STRIPS }, (_, i) => {
      const element = piece('strip');
      const tone = part('tone');
      // The back half: its own paper over its mirrored words, so they show through faintly.
      const back = i >= CURL_STRIPS / 2;
      const glint = back ? part('glint') : null;
      element.append(...(back ? [part('paper'), tone, glint as HTMLElement] : [tone]));
      return { element, tone, glint };
    });
    this.#back = piece('back');
    this.#back.append(part('paper'), this.#light);
    this.#flap.append(...this.#strips.slice(CURL_STRIPS / 2).map((s) => s.element), this.#back);
    const stacked = [
      this.#cast,
      this.#front,
      ...this.#strips.slice(0, CURL_STRIPS / 2).map((s) => s.element),
      this.#flap,
    ];
    // Stacked in this order whatever the page's own rules say, the page beneath (back) under them all.
    if (way < 0) leaving.style.zIndex = '0';
    stacked.forEach((element, i) => {
      element.style.zIndex = String(i + 1);
    });
    this.element.append(...stacked);
    layOver(this.element, to);
  }

  /** The page as `frame` has it. */
  draw(frame: CurlFrame): void {
    const moving = [this.#cast, this.#flap, ...this.#strips.map((s) => s.element)];
    if (frame.resting) {
      for (const element of moving) element.style.visibility = 'hidden';
      this.#front.style.clipPath = 'none';
      return;
    }
    for (const element of [this.#cast, this.#flap]) element.style.visibility = '';
    this.#front.style.clipPath = clipOf(frame.front);
    this.#cast.style.clipPath = clipOf(frame.cast.clip);
    this.#cast.style.backgroundImage = gradientOf(frame.cast.light, CURL_INK.shade);
    this.#strips.forEach((strip, i) => {
      const laid = frame.strips[i];
      strip.element.style.visibility = laid ? '' : 'hidden';
      if (!laid) return;
      strip.element.style.transform = `matrix(${laid.matrix.join(', ')})`;
      strip.element.style.clipPath = clipOf(laid.clip);
      strip.tone.style.backgroundImage = gradientOf(laid.shade, CURL_INK.shade);
      if (strip.glint && laid.glint)
        strip.glint.style.backgroundImage = gradientOf(laid.glint, CURL_INK.light);
    });
    this.#back.style.transform = `matrix(${frame.back.matrix.join(', ')})`;
    this.#back.style.clipPath = clipOf(frame.back.clip);
    this.#light.style.backgroundImage = gradientOf(frame.back.light, CURL_INK.light);
  }

  /** Gone, and the sheet beneath shown again. */
  remove(): void {
    this.element.remove();
    this.#to.style.visibility = '';
  }
}
