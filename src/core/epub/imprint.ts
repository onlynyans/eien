// A book's imprint (#40, Phase 3d, Set as a book): Eien's record of this
// copy, facing its title page, in the machine's voice. How long it is, and
// how it's set, read off the page as it's laid out, so a new face, size or
// width says so; the window draws these words with the face's name in its
// own face.

/** How the page is set, as measured where it's laid out. */
export interface SetAs {
  /** The text's size and its line, in pixels. */
  readonly size: number;
  readonly leading: number;
  /** A line's length, in the text's ems. */
  readonly ems: number;
  /** Two pages face each other. */
  readonly spread: boolean;
  readonly justified: boolean;
  readonly hyphenated: boolean;
}

const count = (n: number, one: string) => `${n.toLocaleString('en')} ${n === 1 ? one : `${one}s`}`;

/** "at 22 on 35 px, lines of 30 em a page, justified and hyphenated". */
export function setAsWords(set: SetAs): string {
  const lines = `lines of ${Math.round(set.ems)} em${set.spread ? ' a page' : ''}`;
  const edge = set.justified ? 'justified' : 'ragged right';
  const hyphens = set.hyphenated ? ' and hyphenated' : '';
  return `at ${Math.round(set.size)} on ${Math.round(set.leading)} px, ${lines}, ${edge}${hyphens}`;
}

/** "61 chapters, 2,450 pages.", the pages a printed edition has (a book without a page-list has none). */
export function lengthWords(chapters: number, pages: number | null): string {
  const parts = [count(chapters, 'chapter')];
  if (pages !== null) parts.push(count(pages, 'page'));
  return `${parts.join(', ')}.`;
}
