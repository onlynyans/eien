// The curl drawn (#40, Phase 3): copies of the live page laid over the
// sheet, each clipped and moved where core/epub's frame says (curl-frame.ts).
// Forward, the page you leave curls away over the next; back, the page
// before curls back over the one you were on. In this order, whatever the
// page's own rules would stack: the page beneath, the roll's shadow on it,
// what stays flat, the roll's front, then what comes back over it (its back
// half and what lies on top), which casts the lifted paper's one shadow.
// On a spread (Phase 3d) one page turns round the gutter, its running head
// with it, and the other lies still until it lands: the curl laid in that
// page's box, a back turn the forward one seen in a mirror.

import { CURL_STRIPS, type CurlFrame, type Light, type Polygon } from '../../../core/epub';
import { h } from '../../dom';
import { layOver, pageCopy } from './page-copy';
import type { TurnLeaf } from './turn-surface';
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

/** The whole sheet as the leaf a single page turns. */
const WHOLE = { x: 0, mirrored: false } as const;

/**
 * A copy of the page made a piece of the curl: a box over the leaf, the
 * curl's clip and matrix its own, holding the whole page laid so the leaf's
 * part of it fills the box (and, mirrored, read the right way round), with
 * its own paper, as a phone's page has none.
 */
function pieceOf(
  copy: HTMLElement,
  leaf: { readonly x: number; readonly width: number; readonly mirrored: boolean },
  sheetWidth: number,
  ...names: string[]
): HTMLElement {
  copy.classList.add('turn-curl__page');
  // Laid where the leaf's part of it fills the piece; the rest of how it stands is ./turn.css's.
  Object.assign(copy.style, {
    left: `${-leaf.x}px`,
    width: `${sheetWidth}px`,
    transform: leaf.mirrored ? 'scaleX(-1)' : '',
    transformOrigin: leaf.mirrored ? `${leaf.x + leaf.width / 2}px 0` : '',
  });
  return h(
    'div',
    { class: ['turn-curl__piece', ...names.map((name) => `turn-curl__${name}`)].join(' ') },
    copy,
  );
}

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

  /** The leaf's whole box, its clip at rest. */
  readonly #rest: string;

  /**
   * Over `to`, the sheet now; `leaving`, a copy of the one before the turn;
   * `leaf`, one page of a spread that turns (on, always: a back turn's mirrored),
   * or null for the whole sheet.
   */
  constructor(
    leaving: HTMLElement,
    to: HTMLElement,
    way: 1 | -1,
    words: string,
    trim?: (words: HTMLElement) => void,
    leaf: TurnLeaf | null = null,
  ) {
    this.#to = to;
    const sheetWidth = to.offsetWidth;
    const box = leaf ?? { ...WHOLE, width: sheetWidth };
    this.#rest = clipOf([
      [0, 0],
      [box.width, 0],
      [box.width, to.offsetHeight],
      [0, to.offsetHeight],
    ]);
    // A spread: the page that doesn't turn lies still, as it was, until the turning one lands on it.
    const still = leaf ? (leaving.cloneNode(true) as HTMLElement) : null;
    const moving = way > 0 || leaf ? leaving : pageCopy(to, words, trim);
    if (way < 0 && !leaf) {
      this.element.append(pieceOf(leaving, box, sheetWidth));
      to.style.visibility = 'hidden';
    }
    const piece = (...names: string[]) =>
      pieceOf(moving.cloneNode(true) as HTMLElement, box, sheetWidth, ...names);
    this.#front = pieceOf(moving, box, sheetWidth);
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
    const beneath = this.element.firstElementChild as HTMLElement | null;
    if (beneath) beneath.style.zIndex = '0';
    stacked.forEach((element, i) => {
      element.style.zIndex = String(i + 1);
    });
    if (leaf && still) {
      // The page lying still: the other side of the gutter from the leaf.
      const stillPiece = pieceOf(still, { ...WHOLE, width: sheetWidth }, sheetWidth, 'still');
      stillPiece.style.clipPath = leaf.mirrored
        ? `inset(0 0 0 ${leaf.x + leaf.width}px)`
        : `inset(0 ${sheetWidth - leaf.x}px 0 0)`;
      const turning = h('div', { class: 'turn-curl__leaf' }, ...stacked);
      Object.assign(turning.style, {
        left: `${leaf.x}px`,
        width: `${leaf.width}px`,
        transform: leaf.mirrored ? 'scaleX(-1)' : '',
      });
      this.element.append(stillPiece, turning);
    } else {
      this.element.append(...stacked);
    }
    layOver(this.element, to);
  }

  /** The page as `frame` has it. */
  draw(frame: CurlFrame): void {
    const moving = [this.#cast, this.#flap, ...this.#strips.map((s) => s.element)];
    if (frame.resting) {
      for (const element of moving) element.style.visibility = 'hidden';
      // The leaf flat, its own box alone: a spread's other page is the still one's.
      this.#front.style.clipPath = this.#rest;
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
