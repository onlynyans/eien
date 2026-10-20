// Characters as a reader counts them: an emoji with its joiners, skin tone
// or flag pair is one, as is a letter with its accents. Text is cut only
// between them.

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** The first `count` characters of `text`, as a reader counts them. */
export function firstGraphemes(text: string, count: number): string {
  let out = '';
  let n = 0;
  for (const { segment } of segmenter.segment(text)) {
    if (n++ >= count) break;
    out += segment;
  }
  return out;
}

/** How far around an index to look for a boundary: longer than any one character. */
const REACH = 64;

/**
 * `index` moved to the nearest boundary between characters: back towards the
 * start (-1) or on towards the end (+1). An index already on one stays.
 */
export function graphemeBoundary(text: string, index: number, direction: -1 | 1): number {
  if (index <= 0 || index >= text.length) return Math.max(0, Math.min(index, text.length));
  const from = Math.max(0, index - REACH);
  const to = Math.min(text.length, index + REACH);
  let before = from;
  for (const { index: at } of segmenter.segment(text.slice(from, to))) {
    const boundary = from + at;
    if (boundary === index) return index;
    if (boundary > index) return direction > 0 ? boundary : before;
    before = boundary;
  }
  return direction > 0 ? to : before;
}
