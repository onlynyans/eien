// The curl drawn (#40, Phase 3): copies of the live page laid over the
// sheet as bands (./band-box.ts), each moved where core/epub's frame says
// (curl-frame.ts), so a frame is transforms alone. Forward, the page you
// leave curls away over the next; back, the page before curls back over the
// one you were on. In this order, whatever the page's own rules would stack:
// the page beneath, the roll's shadow on it, what stays flat, the roll's
// front, then what comes back over it (its back half and what lies on top),
// which casts the lifted paper's one shadow. On a spread (Phase 3d) one page
// turns round the gutter, its running head with it, and the other lies
// still until it lands: the curl laid in that page's box, a back turn the
// forward one seen in a mirror.

import { CURL_STRIPS, type CurlFrame, isBack, reachOf, stripLight } from '../../../core/epub';
import { zoomOf } from '../../css-zoom';
import { h } from '../../dom';
import { BandBox, type BandHolds, part, rampOf } from './band-box';
import { layOver } from './page-copy';
import type { TurnLeaf } from './turn-surface';
import { CURL_INK } from './turn-tokens';

/** The whole sheet as the leaf a single page turns. */
const WHOLE = { x: 0, mirrored: false } as const;

/**
 * A copy of the page made the curl's: laid so the leaf's part of it is at
 * its box's origin (and, mirrored, read the right way round), with its own
 * paper, as a phone's page has none.
 */
function pageIn(
  copy: HTMLElement,
  leaf: { readonly x: number; readonly width: number; readonly mirrored: boolean },
  sheetWidth: number,
): HTMLElement {
  copy.classList.add('turn-curl__page');
  // The rest of how it stands is ./turn.css's.
  Object.assign(copy.style, {
    left: `${-leaf.x}px`,
    width: `${sheetWidth}px`,
    transform: leaf.mirrored ? 'scaleX(-1)' : '',
    transformOrigin: leaf.mirrored ? `${leaf.x + leaf.width / 2}px 0` : '',
  });
  return copy;
}

/**
 * The page facing `leaf` across the gutter, as a leaf of its own laid so its
 * copy shows the sheet where the turning page's back lands once turned:
 * turned on, the left page mirrored (`u` shows `x = gutter − u`); turned
 * back, the leaf seen in its mirror, the right page as it is.
 */
const facing = (leaf: TurnLeaf, sheetWidth: number): TurnLeaf =>
  leaf.mirrored
    ? { x: leaf.x + leaf.width, width: sheetWidth - leaf.x - leaf.width, mirrored: false }
    : { x: 0, width: leaf.x, mirrored: true };

export class CurlView {
  readonly element = h('div', { class: 'turn-curl', attrs: { 'aria-hidden': 'true' } });
  readonly #to: HTMLElement;
  readonly #cast: BandBox;
  readonly #front: BandBox;
  readonly #strips: readonly BandBox[];
  readonly #back: BandBox;
  readonly #crest: BandBox;
  /** The lifted paper's soft shadow, round what lies back on top. */
  readonly #shadow: BandBox;
  readonly #flap = part('flap');
  #moving: boolean | null = null;

  /**
   * Over `to`, the sheet now; `leaving`, a copy of the one before the turn;
   * `coming`, a copy of `to`: for a whole sheet turned back, the page come to
   * that curls back over the one left; on a spread, the page the turn
   * reveals, on the turning page's back; `leaf`, one page of a spread that
   * turns (on, always: a back turn's mirrored), or null for the whole sheet.
   */
  constructor(
    leaving: HTMLElement,
    to: HTMLElement,
    way: 1 | -1,
    coming: HTMLElement | null,
    leaf: TurnLeaf | null = null,
  ) {
    this.#to = to;
    // Over the sheet first, its size the sheet's own box as laid (a part of a pixel under Page
    // zoom), which every copy and band is measured by.
    layOver(this.element, to);
    const sheetWidth = Number.parseFloat(this.element.style.width);
    const sheetHeight = Number.parseFloat(this.element.style.height);
    const box = leaf ?? { ...WHOLE, width: sheetWidth };
    const page = { width: box.width, height: sheetHeight };
    const reach = reachOf(page);
    this.element.style.setProperty('--curl-page-height', `${sheetHeight}px`);
    // A spread: the page that doesn't turn lies still, as it was, until the turning one lands on it.
    const lying = leaf ? (leaving.cloneNode(true) as HTMLElement) : null;
    const moving = way > 0 || leaf || !coming ? leaving : coming;
    // Back on one page, the page left lies beneath them all, and the sheet is hidden until it lands.
    const under = moving !== leaving ? part('under', pageIn(leaving, box, sheetWidth)) : null;
    if (under) {
      under.style.zIndex = '0';
      to.style.visibility = 'hidden';
    }
    const copy = () => pageIn(moving.cloneNode(true) as HTMLElement, box, sheetWidth);
    // A spread's page turns over to show its back, the page the turn reveals, printed on it; one
    // page's back (or a spread's without a copy of that page, one refused) is its own words faint
    // through its paper.
    const back = (): BandHolds =>
      leaf && coming
        ? {
            page: [
              pageIn(coming.cloneNode(true) as HTMLElement, facing(leaf, sheetWidth), sheetWidth),
            ],
          }
        : { page: [copy()], veiled: true };
    const wash = (ink: string) => {
      const element = part('wash');
      element.style.backgroundImage = rampOf(ink, [1, 0]);
      return element;
    };
    this.#cast = new BandBox('cast', page, reach, { over: [wash(CURL_INK.shade)] });
    this.#front = new BandBox('front', page, reach, { page: [pageIn(moving, box, sheetWidth)] });
    this.#strips = Array.from({ length: CURL_STRIPS }, (_, i) => {
      const light = stripLight(i);
      const tone = part('tone');
      tone.style.backgroundImage = rampOf(CURL_INK.shade, light.shade);
      if (!light.glint) return new BandBox('strip', page, reach, { page: [copy()], over: [tone] });
      // The back half, coming over: the page's back.
      const glint = part('glint');
      glint.style.backgroundImage = rampOf(CURL_INK.light, light.glint);
      return new BandBox('strip', page, reach, { ...back(), over: [tone, glint] });
    });
    this.#back = new BandBox('back', page, reach, back());
    this.#crest = new BandBox('crest', page, reach, { over: [wash(CURL_INK.light)] });
    // The page's edges, its shadow round them past the page; cut at the crest by the band's box,
    // where the paper rolls over rather than leaving the page.
    this.#shadow = new BandBox('shadow', page, reach, { page: [part('edge')], uncut: true });
    const roll = (back: boolean) =>
      this.#strips.filter((_, i) => isBack(i) === back).map((strip) => strip.element);
    this.#flap.append(...roll(true), this.#back.element, this.#crest.element);
    const layers = [
      this.#cast.element,
      this.#front.element,
      ...roll(false),
      this.#shadow.element,
      this.#flap,
    ];
    // Stacked in this order whatever the page's own rules say.
    layers.forEach((element, i) => {
      element.style.zIndex = String(i + 1);
    });
    if (under) layers.unshift(under);
    if (leaf && lying) {
      // The page lying still: the other side of the gutter from the leaf.
      const lyingPage = part('under', pageIn(lying, { ...WHOLE, width: sheetWidth }, sheetWidth));
      lyingPage.classList.add('turn-curl__still');
      lyingPage.style.clipPath = leaf.mirrored
        ? `inset(0 0 0 ${leaf.x + leaf.width}px)`
        : `inset(0 ${sheetWidth - leaf.x}px 0 0)`;
      const turning = h('div', { class: 'turn-curl__leaf' }, ...layers);
      Object.assign(turning.style, {
        left: `${leaf.x}px`,
        width: `${leaf.width}px`,
        transform: leaf.mirrored ? 'scaleX(-1)' : '',
      });
      this.element.append(lyingPage, turning);
    } else {
      this.element.append(...layers);
    }
    this.#cutAtPane();
  }

  /**
   * Cut where the pane the sheet lies in cuts: the curl's clip as far past
   * its own box as the pane reaches past it, on the side it reaches furthest
   * (the pane cuts the rest). Measured once, in the curl's own zoomed pixels.
   */
  #cutAtPane(): void {
    const pane = this.element.parentElement?.getBoundingClientRect();
    const own = this.element.getBoundingClientRect();
    if (!pane) return;
    const reach = Math.max(
      0,
      own.left - pane.left,
      own.top - pane.top,
      pane.right - own.right,
      pane.bottom - own.bottom,
    );
    this.element.style.overflowClipMargin = `${reach / zoomOf(this.element)}px`;
  }

  /** The page as `frame` has it. */
  draw(frame: CurlFrame): void {
    this.#front.place(frame.front);
    this.#show(!frame.resting);
    if (frame.resting) return;
    this.#cast.place(frame.cast);
    this.#shadow.place(frame.back);
    for (const shadow of [this.#cast, this.#shadow]) shadow.fade(frame.raised);
    this.#strips.forEach((strip, i) => {
      const band = frame.strips[i];
      strip.show(band !== undefined);
      if (band) strip.place(band);
    });
    this.#back.place(frame.back);
    this.#crest.place(frame.crest);
  }

  /** The roll, what lies on it and its shadow shown, or (at rest) the page flat alone. */
  #show(moving: boolean): void {
    if (moving === this.#moving) return;
    this.#moving = moving;
    this.#flap.style.visibility = moving ? '' : 'hidden';
    for (const band of [this.#cast, this.#shadow, ...this.#strips]) band.show(moving);
  }

  /** Gone, and the sheet beneath shown again. */
  remove(): void {
    this.element.remove();
    this.#to.style.visibility = '';
  }
}
