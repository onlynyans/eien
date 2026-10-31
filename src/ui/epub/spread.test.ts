import { afterEach, describe, expect, it } from 'vitest';
import { spreadOf } from './spread';

/** A book's page in pages, its pane `width` wide (24px of blotter each side), Newsreader's 22px text. */
function pane(width: number, zoom = 1) {
  document.body.innerHTML = `
    <div class="shell"><div class="page__pages">
      <div class="page__leaf" data-view="pages">
        <div class="page__scroll" style="padding-left: 24px; padding-right: 24px">
          <article class="sheet" style="padding-left: 72px; padding-right: 72px">
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
  Object.defineProperty(box, 'clientWidth', { value: 600 });
  box.getBoundingClientRect = () => ({ width: 600 * zoom }) as DOMRect;
  return { room, box, chapter, per: () => spreadOf(box, chapter, room) };
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

  it('is one page scrolling, on a phone, and in a split', () => {
    const scroll = pane(THRESHOLD * 2);
    scroll.room.parentElement?.setAttribute('data-view', 'scroll');
    expect(scroll.per()).toBe(1);
    const phone = pane(THRESHOLD * 2);
    document.querySelector('.shell')?.setAttribute('data-phone', '');
    expect(phone.per()).toBe(1);
    const split = pane(THRESHOLD * 2);
    document.querySelector('.page__pages')?.setAttribute('data-two', '');
    expect(split.per()).toBe(1);
  });
});
