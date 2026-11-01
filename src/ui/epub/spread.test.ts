import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { DEFAULT_SETTINGS, type SettingValues } from '../../core/config';
import { splitSpecOf, twoAtAnyWidth } from '../chrome/splits';
import { spreadOf } from './spread';
import { laidOut } from './test-lines';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);

/**
 * A book's page in pages, its pane `width` wide (24px of blotter each side), Newsreader's 22px text,
 * its box `boxWidth` in its own pixels.
 */
function pane(width: number, zoom = 1, look = 1, boxWidth = 600) {
  document.body.innerHTML = `
    <div class="shell"><div class="page__pages">
      <div class="page__leaf" data-view="pages">
        <div class="page__scroll" style="padding-left: 24px; padding-right: 24px">
          <article class="sheet" style="padding-left: 72px; padding-right: 72px; --look-width: ${look}">
            <div class="epub__pages" style="column-gap: 72px">
              <div class="epub-chapter" style="font-size: 22px"></div>
            </div>
          </article>
        </div>
      </div>
    </div></div>`;
  const room = document.querySelector('.page__scroll') as HTMLElement;
  const box = document.querySelector('.epub__pages') as HTMLElement;
  const chapter = document.querySelector('.epub-chapter') as HTMLElement;
  Object.defineProperty(room, 'clientWidth', { value: width });
  Object.defineProperty(box, 'clientWidth', { value: boxWidth });
  box.getBoundingClientRect = () => ({ width: boxWidth * zoom }) as DOMRect;
  return {
    room,
    box,
    chapter,
    per: (anyWidth = false) => spreadOf(box, chapter, room, anyWidth),
  };
}

// Two 20em pages of 22px, the sheet's margins and the gutter: 880 + 144 + 72, and the blotter.
const THRESHOLD = 2 * 20 * 22 + 2 * 72 + 72 + 2 * 24;

afterEach(() => {
  document.body.replaceChildren();
});

describe('two pages or one (Phase 3d)', () => {
  it('opens to two when the pane holds two pages of 20em, and not a pixel sooner', () => {
    expect(pane(THRESHOLD).per()).toBe(2);
    expect(pane(THRESHOLD - 1).per()).toBe(1);
  });

  it('counts the pane in the sheet’s own pixels: zoomed in, the same pane holds one', () => {
    expect(pane(THRESHOLD, 1.5).per()).toBe(1);
    expect(pane(THRESHOLD * 1.5, 1.5).per()).toBe(2);
  });

  it('counts Page width Narrow’s share of the pane: never two pages under 20em', () => {
    expect(pane(THRESHOLD, 1, 0.84).per()).toBe(1);
    expect(pane((THRESHOLD - 48) / 0.84 + 48 + 1, 1, 0.84).per()).toBe(2);
    // Wide never widens the sheet past its pane.
    expect(pane(THRESHOLD - 1, 1, 1.2).per()).toBe(1);
  });

  it('is one page scrolling, and in a split', () => {
    const scroll = pane(THRESHOLD * 2);
    scroll.room.parentElement?.setAttribute('data-view', 'scroll');
    expect(scroll.per()).toBe(1);
    const split = pane(THRESHOLD * 2);
    document.querySelector('.page__pages')?.setAttribute('data-two', '');
    expect(split.per()).toBe(1);
  });

  it('on a phone, opens where its width holds two pages, as the desktop’s does (decided 2026-10-31)', () => {
    const phone = () => document.querySelector('.shell')?.setAttribute('data-phone', '');
    const wide = pane(THRESHOLD);
    phone();
    expect(wide.per()).toBe(2);
    const narrow = pane(THRESHOLD - 1);
    phone();
    expect(narrow.per()).toBe(1);
    // A phone's two pages side by side (Wide screen's Two pages) are a split: never a spread more.
    const split = pane(THRESHOLD * 2);
    phone();
    document.querySelector('.page__pages')?.setAttribute('data-two', '');
    expect(split.per()).toBe(1);
  });
});

describe('Two pages when narrow, a book’s two pages too (decided 2026-10-31)', () => {
  it('opens two pages at a phone’s narrow width with the setting on, one with it off', () => {
    const narrow = pane(412);
    document.querySelector('.shell')?.setAttribute('data-phone', '');
    expect(narrow.per(true)).toBe(2);
    expect(narrow.per(false)).toBe(1);
  });

  it('never in a split, nor scrolling', () => {
    const split = pane(412);
    document.querySelector('.page__pages')?.setAttribute('data-two', '');
    expect(split.per(true)).toBe(1);
    const scroll = pane(412);
    scroll.room.parentElement?.setAttribute('data-view', 'scroll');
    expect(scroll.per(true)).toBe(1);
  });

  it('reads the one setting notes do, from one place', () => {
    const values = (narrowPages: 'on' | 'off') =>
      ({ ...DEFAULT_SETTINGS, 'appearance.narrowPages': narrowPages }) as SettingValues;
    expect(twoAtAnyWidth(values('on'))).toBe(true);
    expect(twoAtAnyWidth(values('off'))).toBe(false);
    // The split's own spec follows the same reading: side by side at any width.
    expect(splitSpecOf('sheets', twoAtAnyWidth(values('on'))).least).toBe(0);
  });

  // QA (#40, Two pages when narrow): a box short of the gutter and a letter
  // each side (a 360px phone at 200% Interface zoom: 66px, the gutter 72px)
  // gave the columns no width, so the chapter counted one page and its words
  // past it were out of reach; a page narrower than a letter breaks every word.
  it('keeps one page where two would each be narrower than a letter of the text', () => {
    // The gutter 72px, the text 22px: two pages need a box of 72 + 2 × 22.
    const box = (width: number) => pane(412, 1, 1, width).per(true);
    expect(box(72 + 2 * 22)).toBe(2);
    expect(box(72 + 2 * 22 - 1)).toBe(1);
    expect(box(66)).toBe(1);
  });
});

// QA (#40, Phase 3d): the pane's own padding is no page's, the edge strip's
// room at its right included; the sheet's margins as they are worn (a
// narrower pane's, Compact's); and no page laid yet decides nothing.
describe('two pages or one, the pane as it’s worn', () => {
  it('leaves the edge strip’s room out of the pane', () => {
    // Marks on the edge keep 48px more at the pane's right (./edge-strip.css).
    const strip = (width: number) => {
      const at = pane(width);
      at.room.style.paddingRight = `${24 + 48}px`;
      return at.per();
    };
    expect(strip(THRESHOLD + 48)).toBe(2);
    expect(strip(THRESHOLD + 47)).toBe(1);
  });

  it('counts the sheet’s margins as worn: narrower ones open two sooner', () => {
    const compact = (width: number) => {
      const at = pane(width);
      const sheet = document.querySelector('.sheet') as HTMLElement;
      sheet.style.paddingLeft = sheet.style.paddingRight = '32px';
      return at.per();
    };
    expect(compact(THRESHOLD - 80)).toBe(2);
    expect(compact(THRESHOLD - 81)).toBe(1);
  });

  it('is one page with no text measured, or no sheet round the box', () => {
    const none = pane(THRESHOLD * 2);
    none.chapter.style.fontSize = '0px';
    expect(none.per()).toBe(1);
    const bare = pane(THRESHOLD * 2);
    document.querySelector('.sheet')?.classList.remove('sheet');
    expect(bare.per()).toBe(1);
  });
});

// QA (#40, Two pages when narrow): the setting switched on a book's page lays
// it out anew in two pages and back, the place kept, and the same settings
// again lay nothing out.
describe('Two pages when narrow, switched on a book’s page', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lays the page out in two and back as it’s switched, the place kept, and nothing anew unchanged', async () => {
    const { side } = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
    laidOut(side.page);
    await side.open('a.epub');
    const { sheet } = side.page;
    // A narrow pane (happy-dom's is 0 wide): one page unless the setting says two.
    Object.defineProperty(sheet.box, 'clientWidth', { value: 600 });
    Object.defineProperty(sheet.box, 'clientHeight', { value: 600 });
    sheet.box.getBoundingClientRect = () =>
      ({ left: 0, width: 600, top: 0, height: 600 }) as DOMRect;
    const pages = { ...DEFAULT_SETTINGS, 'epub.view': 'pages' } as SettingValues;
    const narrow = (on: 'on' | 'off') =>
      side.follow({ ...pages, 'appearance.narrowPages': on } as SettingValues);
    narrow('off');
    sheet.showPlace(300);
    expect(sheet.box.hasAttribute('data-spread')).toBe(false);
    expect(sheet.page.per).toBe(1);
    const reshow = vi.spyOn(sheet, 'reshow');
    narrow('on');
    expect(reshow).toHaveBeenCalledTimes(1);
    expect(sheet.box.hasAttribute('data-spread')).toBe(true);
    expect(sheet.page.per).toBe(2);
    expect(side.page.chapter.style.columnCount).toBe('2');
    expect(sheet.place).toBe(300);
    // The same settings again: nothing laid out anew.
    narrow('on');
    expect(reshow).toHaveBeenCalledTimes(1);
    narrow('off');
    expect(reshow).toHaveBeenCalledTimes(2);
    expect(sheet.box.hasAttribute('data-spread')).toBe(false);
    expect(sheet.page.per).toBe(1);
    expect(sheet.place).toBe(300);
  });
});
