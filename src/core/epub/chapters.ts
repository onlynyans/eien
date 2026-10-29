// A book's chapters as a reader moves between them (#40, Phase 2): what each
// is called, and the chapters before and after one in the reading order.
// The chapter's foot names them, and a quote names the one it came from.

import type { ContentsEntry } from './contents';
import type { SpineItem } from './package';

/**
 * What the spine's item `index` is called: its first row in the contents;
 * null for one the contents don't name (a title page, a cover).
 */
export function chapterTitle(contents: readonly ContentsEntry[], index: number): string | null {
  return (
    contents.find((entry) => entry.spine === index && entry.title.trim() !== '')?.title.trim() ??
    null
  );
}

/** The chapter `step` (1 or −1) on from `index` in the reading order, passing those out of it; null at an end. */
export function chapterBeside(
  spine: readonly SpineItem[],
  index: number,
  step: 1 | -1,
): number | null {
  for (let at = index + step; at >= 0 && at < spine.length; at += step) {
    if (spine[at]?.linear) return at;
  }
  return null;
}
