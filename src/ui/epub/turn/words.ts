// Words (#40, Phase 3, Turning 3): the paper never moves, only the ink.
// The page's words step out a little toward where you're going in the
// quick time, and the next page's step in from the other side over the
// calm time after them, so two pages' words never lie on each other.

import type { Way } from '../../../core/epub';
import type { StepMotion } from './slide';

const across = (x: number) => `${x}px 0`;

/**
 * The words `coming` step in a `step` long from the side they come from
 * (`way` on, from the right), over `into` after `delay`. Alone, a chapter
 * turned in Scroll (#71): no page to move there, only its words.
 */
export const stepIn = (
  coming: HTMLElement,
  way: Way,
  step: number,
  into: number,
  ease: string,
  delay = 0,
): Animation =>
  coming.animate(
    [
      { opacity: 0, translate: across(way * step) },
      { opacity: 1, translate: across(0) },
    ],
    { duration: into, delay, easing: ease, fill: 'both' },
  );

/** Words' motion: out over `out`, in over `into` after it, each a `step` long. */
export function words(
  { leaving, coming, way }: StepMotion,
  step: number,
  out: number,
  into: number,
  ease: string,
): Animation[] {
  return [
    leaving.animate(
      [
        { opacity: 1, translate: across(0) },
        { opacity: 0, translate: across(-way * step) },
      ],
      { duration: out, easing: ease, fill: 'both' },
    ),
    stepIn(coming, way, step, into, ease, out),
  ];
}
