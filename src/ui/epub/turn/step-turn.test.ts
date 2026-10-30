import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageCopy } from './page-copy';
import { slide } from './slide';
import { stepTurn } from './step-turn';
import type { TurnTokens } from './turn-tokens';
import { words } from './words';

const TOKENS: TurnTokens = { calm: 220, quick: 120, ease: 'linear', step: 8, cast: 32, crest: 24 };

/** Each element's keyframes and timing, as asked of `animate`. */
function animated() {
  const asked: { element: Element; keyframes: Keyframe[]; options: KeyframeAnimationOptions }[] =
    [];
  const cancelled: Element[] = [];
  vi.spyOn(Element.prototype, 'animate').mockImplementation(function (
    this: Element,
    keyframes,
    options,
  ) {
    asked.push({
      element: this,
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
    });
    return {
      finished: new Promise(() => {}),
      finish: () => {},
      cancel: () => cancelled.push(this),
    } as unknown as Animation;
  });
  return { asked, cancelled };
}

const across = (frame: Keyframe | undefined) => Number.parseFloat(String(frame?.translate ?? '0'));

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('Slide', () => {
  it('carries the words a page toward where you came from, the next page’s in from where you go', () => {
    const { asked } = animated();
    const [leaving, coming] = [document.createElement('p'), document.createElement('p')];
    slide({ leaving, coming, way: 1 }, 400, 220, 'linear');
    expect(asked.map(({ keyframes }) => keyframes.map(across))).toEqual([
      [0, -400],
      [400, 0],
    ]);
    slide({ leaving, coming, way: -1 }, 400, 220, 'linear');
    expect(asked.slice(2).map(({ keyframes }) => keyframes.map(across))).toEqual([
      [0, 400],
      [-400, 0],
    ]);
  });
});

describe('Words', () => {
  it('steps the words out toward where you go in the quick time, the next in over the calm after it', () => {
    const { asked } = animated();
    const [leaving, coming] = [document.createElement('p'), document.createElement('p')];
    words({ leaving, coming, way: 1 }, 8, 120, 220, 'linear');
    const [out, into] = asked;
    expect(out?.keyframes.map(across)).toEqual([0, -8]);
    expect(out?.keyframes.map((frame) => frame.opacity)).toEqual([1, 0]);
    expect(out?.options.duration).toBe(120);
    expect(into?.keyframes.map(across)).toEqual([8, 0]);
    expect(into?.options).toMatchObject({ duration: 220, delay: 120 });
  });
});

describe('a step’s run', () => {
  it('lays the words left over the sheet, and puts them and its motion away once finished', () => {
    const { cancelled } = animated();
    const sheet = document.createElement('article');
    sheet.innerHTML = '<p class="words" aria-describedby="x">Page 2</p>';
    document.body.append(sheet);
    const copy = pageCopy(sheet, '.words');
    expect(copy.querySelector('[aria-describedby]')).toBeNull();
    const ended = vi.fn();
    const run = stepTurn({
      style: 'words',
      way: 1,
      copy,
      sheet,
      words: '.words',
      tokens: TOKENS,
      scale: 1,
      ended,
    });
    expect(copy.isConnected).toBe(true);
    run?.finish();
    expect(copy.isConnected).toBe(false);
    expect(cancelled).toHaveLength(2);
    expect(ended).toHaveBeenCalledOnce();
  });

  it('runs nothing at speed 0', () => {
    const sheet = document.createElement('article');
    sheet.innerHTML = '<p class="words">Page 2</p>';
    const copy = pageCopy(sheet, '.words');
    const run = stepTurn({
      style: 'slide',
      way: 1,
      copy,
      sheet,
      words: '.words',
      tokens: TOKENS,
      scale: 0,
      ended: () => {},
    });
    expect(run).toBeNull();
  });
});
