// Over generated chapters in pages (#67): a book with no page-list numbers
// each of a chapter's pages as laid out, so turning through it from its
// front matter to its last page, one page or a spread at a time, says every
// page from 1 to the last once each, in order, the colophon and the folios
// alike; never a front page, a blank one, or a page past the chapter's end.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type Epub, pageRoles } from '../../core/epub';
import type { BookCount } from './book-count';
import { BookFoot } from './book-foot';
import { bookPlace } from './book-place';
import type { EpubPage } from './epub-page';
import { FRONT_PAGES } from './front-matter';
import { RunningHeads } from './running-heads';
import type { PageShown } from './sight';

/** A book's place over a foot, heads and a sheet in pages the test turns. */
function turning() {
  const foot = new BookFoot(
    () => {},
    () => {},
  );
  const heads = new RunningHeads();
  const sheet = {
    sight: [] as PageShown[],
    paged: true,
    page: { at: 0, of: 1, per: 1 as 1 | 2 },
  };
  const page = {
    foot,
    heads,
    element: document.createElement('div'),
    leaf: document.createElement('div'),
    chapter: document.createElement('div'),
    sheet,
    edges: { through: () => {}, after: 0, before: 0 },
    focus: () => {},
  } as unknown as EpubPage;
  const place = bookPlace({
    page,
    epub: () =>
      ({
        spine: [{ linear: true, size: 1000 }],
        contents: [],
        title: 'The Book',
      }) as unknown as Epub,
    spine: () => 0,
    count: () => ({ lengths: [100_000], print: [] }) as unknown as BookCount,
    marks: () => [],
    goTo: () => {},
  });
  const said = () =>
    foot.figures.find((each) => each.classList.contains('colophon__page'))?.textContent ?? '';
  const folios = () => [...heads.folio.children].map((each) => each.textContent ?? '');
  return { place, sheet, said, folios };
}

describe('a chapter’s own pages, turned through (#67)', () => {
  it('are said from 1 to the last, once each and in order, the colophon as the folios', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(0, FRONT_PAGES),
        fc.constantFrom<1 | 2>(1, 2),
        fc.integer({ min: 1, max: 40 }),
        (front, per, text) => {
          const { place, sheet, said, folios } = turning();
          const columns = front + text;
          const numbered: number[] = [];
          for (let at = 0; at * per < columns; at++) {
            // Each page's words begin 100 on from the last's.
            sheet.sight = pageRoles(at, per, front, columns).map((role, i) => ({
              role,
              from: Math.max(0, at * per + i - front) * 100,
            }));
            // The chapter's pages, its front matter left out: those before this sight, and all of them.
            sheet.page = { at: Math.max(0, at * per - front), of: columns - front, per };
            place.inSight(sheet.sight[0]?.from ?? 0, (at + 1) * per * 100);
            const shown = folios().filter(Boolean).map(Number);
            numbered.push(...shown);
            const words = said();
            if (shown.length === 0) expect(words).toBe('');
            else
              expect(words).toBe(
                shown.length === 1
                  ? `page ${shown[0]} of ${text}`
                  : `pages ${shown[0]}–${shown[1]} of ${text}`,
              );
          }
          expect(numbered).toEqual(Array.from({ length: text }, (_, i) => i + 1));
        },
      ),
    );
  });
});
