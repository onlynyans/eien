// Slide or Words run (#40, Phase 3): the page you left, its words alone, laid
// over the one you're on, and the setting's motion between their words. Put
// away once it's done, or at once when finished early (a key mid-turn).

import { isInstant, slideTime, type Way, wordsTime } from '../../../core/epub';
import { layOver, WORDS } from './page-copy';
import { slide } from './slide';
import type { TurnTokens } from './turn-tokens';
import { words } from './words';

export interface Stepping {
  /** Done now: the motion at its end, and the copy gone. */
  finish(): void;
}

export interface StepOf {
  readonly style: 'slide' | 'words';
  readonly way: Way;
  /** The page you left, copied (./page-copy.ts), and the sheet you're on. */
  readonly copy: HTMLElement;
  readonly sheet: HTMLElement;
  /** Where the words are in a sheet. */
  readonly words: string;
  readonly tokens: TurnTokens;
  readonly scale: number;
  /** Told once, when it's put away. */
  ended(): void;
}

/** The motion begun; null where there's none to run (instant, or no words to move). */
export function stepTurn(of: StepOf): Stepping | null {
  const { copy, sheet, tokens, scale, way } = of;
  const coming = sheet.querySelector<HTMLElement>(of.words);
  const leaving = copy.querySelector<HTMLElement>(`[${WORDS}]`);
  const timing = wordsTime(tokens.quick, tokens.calm, scale);
  const time = of.style === 'slide' ? slideTime(tokens.calm, scale) : timing.in;
  if (!coming || !leaving || isInstant(time)) return null;
  copy.classList.add('turn-copy--words');
  layOver(copy, sheet);
  const motion = { leaving, coming, way };
  const animations =
    of.style === 'slide'
      ? slide(motion, leaving.offsetWidth, time, tokens.ease)
      : words(motion, tokens.step, timing.out, timing.in, tokens.ease);
  let away = false;
  const putAway = () => {
    if (away) return;
    away = true;
    copy.remove();
    for (const animation of animations) animation.cancel();
    of.ended();
  };
  Promise.all(animations.map((animation) => animation.finished)).then(putAway, putAway);
  return {
    finish: () => {
      for (const animation of animations) animation.finish();
      putAway();
    },
  };
}
