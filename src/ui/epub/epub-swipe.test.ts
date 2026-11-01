// A finger swiped across a book's page in Scroll turns the chapter (#71):
// the place left kept a step back (the colophon's Back, the system's back,
// #70), and the chapter's words stepping in as Words does, at the Turn speed.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { DEFAULT_SETTINGS } from '../../core/config';
import type { EpubSide } from './epub-side-types';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);
const book = () => ({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });

/** What `animate` was asked, and what it cancelled. */
function animated() {
  const asked: { keyframes: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
  const cancelled = vi.fn();
  vi.spyOn(Element.prototype, 'animate').mockImplementation((keyframes, options) => {
    asked.push({
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
    });
    return { finished: new Promise(() => {}), cancel: cancelled } as unknown as Animation;
  });
  return { asked, cancelled };
}

/** A book open in Scroll at `speed`, the window's times `calm` (0 with reduced motion). */
async function scrolling(speed: '0' | '1' | '2' = '1', calm = '220ms') {
  const { side } = sideWith(book());
  await side.open('a.epub');
  side.follow({ ...DEFAULT_SETTINGS, 'epub.view': 'scroll', 'epub.turnSpeed': speed });
  side.page.leaf.getBoundingClientRect = () => ({ width: 400, height: 600 }) as DOMRect;
  for (const [name, value] of [
    ['--eien-calm', calm],
    ['--eien-quick', '120ms'],
    ['--eien-space-2', '8px'],
  ] as const)
    side.page.chapter.style.setProperty(name, value);
  return side;
}

/** One finger across the page, `dx` across. */
function swipe(side: EpubSide, dx: number) {
  const target = side.page.chapter;
  const touch = (x: number) => new Touch({ identifier: 1, target, clientX: x, clientY: 200 });
  const fire = (type: string, touches: Touch[], changed: Touch[]) =>
    target.dispatchEvent(new TouchEvent(type, { bubbles: true, touches, changedTouches: changed }));
  fire('touchstart', [touch(200)], [touch(200)]);
  fire('touchend', [], [touch(200 + dx)]);
}

const backWord = (side: EpubSide) => side.page.foot.figures[0]?.textContent;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('a swipe across a book in Scroll', () => {
  it('turns to the next chapter at its start, the place left a step back', async () => {
    animated();
    const side = await scrolling();
    expect(side.spine).toBe(1);
    swipe(side, -150);
    await vi.waitFor(() => expect(side.spine).toBe(2));
    expect(backWord(side)).toBe('Back to Chapter I');
    expect(side.back()).toBe(true);
    await vi.waitFor(() => expect(side.spine).toBe(1));
    expect(side.back()).toBe(false);
  });

  it('turns back to the chapter before, and at the first nothing happens', async () => {
    animated();
    const side = await scrolling();
    await side.go(2);
    swipe(side, 150);
    await vi.waitFor(() => expect(side.spine).toBe(1));
    swipe(side, 150); // the title page before Chapter I is the first item in the spine
    await vi.waitFor(() => expect(side.spine).toBe(0));
    swipe(side, 150);
    await new Promise((done) => setTimeout(done, 20));
    expect(side.spine).toBe(0);
  });

  it('steps the chapter’s words in from the side it comes from, over the calm time at the Turn speed', async () => {
    const { asked } = animated();
    const side = await scrolling('2');
    swipe(side, -150);
    await vi.waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]?.keyframes.map((frame) => frame.translate)).toEqual(['8px 0', '0px 0']);
    expect(asked[0]?.options.duration).toBe(440);
    swipe(side, 150);
    await vi.waitFor(() => expect(asked).toHaveLength(2));
    expect(asked[1]?.keyframes[0]?.translate).toBe('-8px 0');
  });

  it('changes the chapter at once at Turn speed 0, and with reduced motion', async () => {
    const { asked } = animated();
    for (const [speed, calm] of [
      ['0', '220ms'],
      ['1', '0ms'],
    ] as const) {
      const side = await scrolling(speed, calm);
      const from = side.spine;
      swipe(side, -150);
      await vi.waitFor(() => expect(side.spine).toBe(from + 1));
    }
    expect(asked).toHaveLength(0);
  });

  it('a jump while the words step in lands at once', async () => {
    const { asked, cancelled } = animated();
    const side = await scrolling();
    swipe(side, -150);
    await vi.waitFor(() => expect(asked).toHaveLength(1));
    await side.goTo(3, 0);
    expect(cancelled).toHaveBeenCalled();
  });

  it('steps in a chapter pressed at the foot, too', async () => {
    const { asked } = animated();
    const side = await scrolling();
    side.page.element.querySelector<HTMLButtonElement>('[data-turn="next"]')?.click();
    await vi.waitFor(() => expect(asked).toHaveLength(1));
    expect(side.spine).toBe(2);
    expect(side.back()).toBe(false); // a chapter chosen keeps no step back
  });

  it('never turns the chapter in pages', async () => {
    animated();
    const side = await scrolling();
    side.follow({ ...DEFAULT_SETTINGS, 'epub.view': 'pages' });
    swipe(side, -150);
    await new Promise((done) => setTimeout(done, 20));
    expect(side.spine).toBe(1);
  });
});
