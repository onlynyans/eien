// A band of the curl drawn (#40, Phase 3): a box over the page, its edges
// the band's cuts, holding the page laid back inside it so the paper stands
// where the band says, and over the page the band's own veil and light, cut
// to the page too. Each is drawn once as the turn begins and then only
// moved: a frame changes its transforms and nothing else, so a phone's
// window composites it and never draws it again (a clip or a gradient
// changed each frame was drawn anew each frame, and stuttered).

import { BAND_BOX, type Band, type Matrix, type PageBox, type Ramp } from '../../../core/epub';
import { h } from '../../dom';

const matrixOf = (m: Matrix) => `matrix(${m.join(', ')})`;

/**
 * A ramp across a band, in `ink`: its strength at the band's first edge,
 * nearer the fold, and its last. Drawn across the middle third of what's
 * over the band (./turn.css), held either side.
 */
export const rampOf = (ink: string, [start, end]: Ramp): string =>
  `linear-gradient(90deg, ${[start, end]
    .map(
      (strength, i) =>
        `color-mix(in srgb, ${ink} ${(strength * 100).toFixed(1)}%, transparent) ${i ? '66.667%' : '33.333%'}`,
    )
    .join(', ')})`;

/** One of the curl's parts that isn't a band: the paper's veil, a shade, a light. */
export const part = (name: string) => h('div', { class: `turn-curl__${name}` });

export class BandBox {
  readonly element: HTMLElement;
  readonly #inside: HTMLElement;
  readonly #over: HTMLElement | null;
  #shown = true;

  /**
   * A band named `name` (a class, `turn-curl__<name>`) over `page`, `reach`
   * either side of the fold's point, holding `copy` (a copy of the page, laid
   * inside) if any and `over` it: the veil and lights, drawn once across the
   * band.
   */
  constructor(
    name: string,
    page: PageBox,
    reach: number,
    copy: HTMLElement | null,
    ...over: HTMLElement[]
  ) {
    const height = `${2 * reach}px`;
    this.element = h('div', { class: `turn-curl__band turn-curl__${name}` });
    Object.assign(this.element.style, { width: `${BAND_BOX}px`, height });
    this.#inside = h('div', { class: 'turn-curl__inside' });
    Object.assign(this.#inside.style, { width: `${page.width}px`, height: `${page.height}px` });
    if (copy) this.#inside.append(copy);
    this.#over = over.length > 0 ? h('div', { class: 'turn-curl__over' }, ...over) : null;
    if (this.#over) {
      // A band's box and as much again either side: drawn once at the band's first width, a sliver
      // as the roll begins, its few pixels blend with nothing at their edges; the band's edges then
      // fall inside, where stretching them is exact.
      Object.assign(this.#over.style, { width: `${3 * BAND_BOX}px`, height });
      this.#inside.append(this.#over);
    }
    this.element.append(this.#inside);
  }

  /** Laid where `band` says. */
  place(band: Band): void {
    this.element.style.transform = matrixOf(band.place);
    this.#inside.style.transform = matrixOf(band.paper);
    // Its middle third on the band's box.
    if (this.#over) this.#over.style.transform = `${matrixOf(band.box)} translateX(-${BAND_BOX}px)`;
  }

  /** Shown or hidden; told only when that changes, as any other style is drawn again. */
  show(shown: boolean): void {
    if (shown === this.#shown) return;
    this.#shown = shown;
    this.element.style.visibility = shown ? '' : 'hidden';
  }
}
