// Where the divider between two pages stands (the split, spec §4): the left
// page's share of the page pane, remembered on this device as the panes'
// widths are (./pane-state.ts); and whether two pages fit beside each other
// at all. Only the arithmetic is here; ../page/divider.ts draws it.

import { PAGE_MIN } from './pane-state';

/** The two pages alike: where the divider starts, and where a double-click puts it. */
export const EVEN = 0.5;

/** Whether two pages fit in `width`, each at least PAGE_MIN wide; else they fold into one. */
export const twoFit = (width: number): boolean => width >= 2 * PAGE_MIN;

/** The share as stored; anything missing, mistyped or not strictly between 0 and 1 is even. */
export function readShare(text: string | null): number {
  let data: unknown;
  try {
    data = JSON.parse(text ?? 'null');
  } catch {
    return EVEN;
  }
  const share = (data as { share?: unknown } | null)?.share;
  return typeof share === 'number' && share > 0 && share < 1 ? share : EVEN;
}

/**
 * The share shown in a pane `width` wide: each page at least PAGE_MIN, so a
 * narrower pane may show less than what's remembered, and a wider one gives
 * it back. Even when two pages don't fit (they fold, and nothing is shown).
 */
export function shownShare(share: number, width: number): number {
  if (!twoFit(width) || !Number.isFinite(share)) return EVEN;
  const least = PAGE_MIN / width;
  return Math.min(1 - least, Math.max(least, share));
}

/** `share` moved `by` pixels in a pane `width` wide: from where it's shown, within the limits. */
export function movedShare(share: number, width: number, by: number): number {
  if (!twoFit(width) || !Number.isFinite(by)) return shownShare(share, width);
  return shownShare(shownShare(share, width) + by / width, width);
}
