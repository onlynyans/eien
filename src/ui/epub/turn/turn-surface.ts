// What a page turn turns over (#40, Phase 3): the surface a book's page
// gives it (its sheet, its words, a step on and back, the setting's motion),
// and what a test may stand in for (the frames, the tokens, chance).

import type { Motion, Way } from '../../../core/epub';
import type { Frames } from './next-frame';
import type { TurnTokens } from './turn-tokens';

/** The Page turn setting's motions. */
export type TurnStyle = Motion;

/**
 * The part of the sheet a curl turns, in the sheet's own pixels: one page of
 * two facing (a spread, #40 Phase 3d), turned round the gutter, the other
 * page lying still until it lands. `mirrored`: the left page, turned back,
 * curled as the right page turns on, seen in a mirror.
 */
export interface TurnLeaf {
  readonly x: number;
  readonly width: number;
  readonly mirrored: boolean;
}

export interface TurnSurface {
  /** The sheet in sight now: what turns. It clips what lies outside its box. */
  sheet(): HTMLElement | null;
  /** Where its words are, within a sheet or a copy of one: what Slide and Words move. */
  readonly words: string;
  /**
   * A copy's words kept to those round the sight, laid as the page has them:
   * a turn moves a page, never a whole chapter. False for none to be had: the
   * page turns without a motion.
   */
  trim?(words: HTMLElement): boolean;
  /**
   * The book a page `way` on, its new page on the sheet; false at the book's
   * end. At once within a chapter; into another, once that's drawn (a
   * promise), the motion waiting for it.
   */
  step(way: Way): boolean | Promise<boolean>;
  /** Back where the last step began (a hand's turn fallen back): at once, or once drawn. */
  unstep(): void | Promise<void>;
  /** The Page turn and Turn speed now. */
  how(): { readonly style: TurnStyle; readonly speed: number };
  /** The page that turns `way`, when the sheet holds two (else the whole sheet turns). */
  leaf?(way: Way): TurnLeaf | null;
}

export interface PageTurnOf {
  readonly random?: () => number;
  readonly frames?: Frames;
  readonly tokens?: (sheet: HTMLElement) => TurnTokens;
}
