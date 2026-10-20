// How a book numbers its chapters: i, ii, iii (the default) or 1, 2, 3.

export type NumeralStyle = 'roman' | 'arabic';

const ROMAN: readonly [string, number][] = [
  ['m', 1000],
  ['cm', 900],
  ['d', 500],
  ['cd', 400],
  ['c', 100],
  ['xc', 90],
  ['l', 50],
  ['xl', 40],
  ['x', 10],
  ['ix', 9],
  ['v', 5],
  ['iv', 4],
  ['i', 1],
];

/** Chapter `n` (from 1) in `style`. Not a positive whole number: as written. */
export function chapterNumber(n: number, style: NumeralStyle = 'roman'): string {
  if (style === 'arabic' || !Number.isInteger(n) || n < 1) return String(n);
  let out = '';
  let rest = n;
  for (const [glyph, value] of ROMAN) {
    for (; rest >= value; rest -= value) out += glyph;
  }
  return out;
}
