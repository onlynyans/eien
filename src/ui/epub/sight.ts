// What a book in pages has in sight (#40, Phase 3d): one page, or a spread's
// two, each with where its words begin and what it is to its chapter; and
// where the page stands, to be put back exactly (a turn that fell back).

import type { PageRole } from '../../core/epub';

/** A page in sight: the offset its words begin at (its end's, for a spread's empty recto), and its part. */
export interface PageShown {
  readonly from: number;
  readonly role: PageRole;
}

/** Where a book in pages stands: its place, the sight shown, and a front page turned to (else null). */
export interface Spot {
  readonly offset: number;
  readonly page: number;
  readonly front: number | null;
}

/** Whether `sight` is Eien's front matter alone: none of the book's words to count, mark or name. */
export const allFront = (sight: readonly PageShown[]): boolean =>
  sight.length > 0 && sight.every((page) => page.role === 'front');
