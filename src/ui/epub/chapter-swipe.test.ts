// A finger across a book's page in Scroll turns the chapter (#71): a swipe,
// against a scroll, a press that chose words, two fingers, and pages.

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { chapterSwipe } from './chapter-swipe';

const WIDTH = 400;
let scroller: HTMLElement;
let sheet: HTMLElement;
let paged: boolean;
let turn: Mock<(way: 1 | -1) => void>;
let stop: () => void;

beforeEach(() => {
  paged = false;
  turn = vi.fn<(way: 1 | -1) => void>();
  scroller = document.createElement('div');
  sheet = document.createElement('article');
  sheet.innerHTML = '<p>The words of the chapter.</p>';
  sheet.getBoundingClientRect = () => ({ width: WIDTH, height: 600 }) as DOMRect;
  scroller.append(sheet);
  document.body.append(scroller);
  stop = chapterSwipe({ target: scroller, sheet: () => sheet, paged: () => paged, turn });
});
afterEach(() => {
  stop();
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

const touch = (x: number, y: number, identifier = 1) =>
  new Touch({ identifier, target: sheet, clientX: x, clientY: y });
const fire = (type: string, touches: Touch[], changed: Touch[] = touches) =>
  sheet.dispatchEvent(new TouchEvent(type, { bubbles: true, touches, changedTouches: changed }));
/** One finger from `from` to `to`, `between` run while it's down. */
function swipe(from: [number, number], to: [number, number], between = () => {}) {
  fire('touchstart', [touch(...from)]);
  fire('touchmove', [touch(...to)]);
  between();
  fire('touchend', [], [touch(...to)]);
}

describe('a finger across a book’s page in Scroll (#71)', () => {
  it('turns on to the next chapter swiped leftward, back to the one before rightward', () => {
    swipe([300, 200], [150, 210]);
    swipe([100, 200], [250, 190]);
    expect(turn.mock.calls).toEqual([[1], [-1]]);
  });

  it('needs a quarter of the page across', () => {
    swipe([300, 200], [300 - WIDTH / 4 + 2, 200]);
    expect(turn).not.toHaveBeenCalled();
    swipe([300, 200], [300 - WIDTH / 4, 200]);
    expect(turn).toHaveBeenCalledWith(1);
  });

  it('is never a scroll: more down than across, or the page scrolled under it', () => {
    swipe([300, 100], [150, 300]);
    swipe([300, 200], [150, 210], () => {
      scroller.scrollTop = 40;
    });
    expect(turn).not.toHaveBeenCalled();
  });

  it('never turns with words chosen in the page (a long press chose them)', () => {
    const words = sheet.querySelector('p')?.firstChild as Text;
    swipe([300, 200], [150, 200], () =>
      document.getSelection()?.selectAllChildren(words.parentNode as Node),
    );
    expect(turn).not.toHaveBeenCalled();
  });

  it('never turns for two fingers', () => {
    fire('touchstart', [touch(300, 200)]);
    fire('touchstart', [touch(300, 200), touch(320, 260, 2)]);
    fire('touchend', [touch(320, 260, 2)], [touch(150, 200)]);
    expect(turn).not.toHaveBeenCalled();
  });

  it('never turns for a touch the system took (its back at the screen’s edge)', () => {
    fire('touchstart', [touch(2, 200)]);
    fire('touchcancel', [], [touch(150, 200)]);
    fire('touchend', [], [touch(150, 200)]);
    expect(turn).not.toHaveBeenCalled();
  });

  it('leaves pages to the turn’s own hand', () => {
    paged = true;
    swipe([300, 200], [150, 200]);
    expect(turn).not.toHaveBeenCalled();
  });

  it('never turns over what scrolls sideways itself (a wide table)', () => {
    const wide = document.createElement('div');
    wide.style.overflowX = 'auto';
    Object.defineProperty(wide, 'scrollWidth', { value: 900 });
    Object.defineProperty(wide, 'clientWidth', { value: 300 });
    sheet.append(wide);
    wide.dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        touches: [new Touch({ identifier: 1, target: wide, clientX: 300, clientY: 200 })],
      }),
    );
    fire('touchend', [], [touch(150, 200)]);
    expect(turn).not.toHaveBeenCalled();
  });
});
