// How long a turn takes (#40, Phase 3). Each motion's time is a multiple
// of Eien's calm (or quick) time, as the window's tokens set it, times the
// Turn speed: instant (0) to four times slower (the setting, Phase 3c, twice
// as slow as designed by default). The speed sets a key's turn and the finish after you let go; a
// drag always follows the hand. Reduced motion is the tokens' own: they're
// 0 there (tokens.css), so every time here is 0, and a time of 0 is
// instant.

/** The slowest Turn speed: four times the designed time. */
export const SLOWEST = 4;

/** The Turn speed as a scale on the designed time: 0 (instant) to SLOWEST; anything else, as designed. */
export const turnScale = (speed: number): number =>
  Number.isFinite(speed) ? Math.min(SLOWEST, Math.max(0, speed)) : 1;

/** Whether a motion of `time` milliseconds is no motion: the page changes at once. */
export const isInstant = (time: number): boolean => !(time > 0);

/** The curl's finish lands in one and a half calm times, a key's at its own pace. */
const CURL_CALMS = 1.5;

/** How long the curl's finish takes to land, at `pace` (a key's stroke; 1 for a hand's). */
export const curlTime = (calm: number, scale: number, pace = 1): number =>
  CURL_CALMS * calm * scale * pace;

/** Slide: the words carried a page over the calm time. */
export const slideTime = (calm: number, scale: number): number => calm * scale;

/** Words: the page's words step out over the quick time, the next page's step in over the calm time after. */
export const wordsTime = (
  quick: number,
  calm: number,
  scale: number,
): { readonly out: number; readonly in: number } => ({ out: quick * scale, in: calm * scale });

/** The Page turn's motions. */
export type Motion = 'curl' | 'slide' | 'words';

/** How long a key's turn of `motion` takes, its pace as designed: 0 is no motion at all. */
export function motionTime(motion: Motion, calm: number, quick: number, scale: number): number {
  if (motion === 'curl') return curlTime(calm, scale);
  if (motion === 'slide') return slideTime(calm, scale);
  return wordsTime(quick, calm, scale).in;
}
