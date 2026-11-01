// The chapter on a book's sheet (./chapter-sheet.ts): here, what it gives a
// turn's copy. A copy it can't keep to the page in sight is none at all, and
// none is inked: the page then turns without a motion (./turn/page-turn.ts).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChapterSheet } from './chapter-sheet';

function sheetOf() {
  const scroller = document.createElement('div');
  const dock = document.createElement('div');
  document.body.append(scroller, dock);
  const copied = vi.fn();
  const sheet = new ChapterSheet({
    scroller,
    dock,
    moved: () => {},
    rested: () => {},
    inSight: () => {},
    follow: () => {},
    quote: () => {},
    highlight: () => {},
    copy: () => {},
    inHighlight: () => false,
    copied,
  });
  scroller.append(sheet.box);
  sheet.element.innerHTML = '<p>One</p><p>Two</p>';
  return { sheet, copied };
}

afterEach(() => document.body.replaceChildren());

describe('a turn’s copy of the chapter', () => {
  it('is none, and inked never, while the chapter scrolls or has no page in sight', () => {
    const { sheet, copied } = sheetOf();
    const copy = sheet.element.cloneNode(true) as HTMLElement;
    expect(sheet.trim(copy)).toBe(false);
    // In pages, but no page laid yet: nothing to keep the copy to.
    sheet.paged = true;
    expect(sheet.trim(copy)).toBe(false);
    expect(copied).not.toHaveBeenCalled();
  });
});
