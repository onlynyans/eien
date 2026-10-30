// What a turn reads of the window's tokens (#40, Phase 3), once as it
// begins, from the sheet it turns: the times and the ease every motion of
// Eien's runs on, and the lengths the turn's steps and washes are made of.
// Under reduced motion tokens.css sets the times to 0, so a turn is instant
// there with nothing of its own to ask. The curl's inks are never read:
// they're worn as var()s, so the theme's day and night carry them.

/** The curl's two inks, by name (tokens.css, Depth's exception); the third, how much shows through, is turn.css's. */
export const CURL_INK = {
  shade: 'var(--eien-curl-shade)',
  light: 'var(--eien-curl-light)',
} as const;

export interface TurnTokens {
  /** --eien-calm and --eien-quick, in milliseconds. */
  readonly calm: number;
  readonly quick: number;
  /** --eien-ease. */
  readonly ease: string;
  /** Words' step: --eien-space-2. */
  readonly step: number;
  /** The roll's shadow on the page beneath, --eien-space-6, and the crest's light, --eien-space-5. */
  readonly cast: number;
  readonly crest: number;
}

/** A time token as milliseconds: `220ms`, `0.22s`; NaN for none, which counts as instant. */
export function millisecondsOf(value: string): number {
  const time = value.trim();
  const amount = Number.parseFloat(time);
  return time.endsWith('ms') ? amount : time.endsWith('s') ? amount * 1000 : Number.NaN;
}

/** The tokens as `element` wears them now. */
export function turnTokens(element: Element): TurnTokens {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(name);
  const length = (name: string) => Number.parseFloat(token(name)) || 0;
  return {
    calm: millisecondsOf(token('--eien-calm')),
    quick: millisecondsOf(token('--eien-quick')),
    // None read (a bare document, as in a test's): no ease of the turn's own.
    ease: token('--eien-ease').trim() || 'linear',
    step: length('--eien-space-2'),
    cast: length('--eien-space-6'),
    crest: length('--eien-space-5'),
  };
}
