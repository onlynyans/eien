import { describe, expect, it } from 'vitest';
import { WordCount } from './word-count';

describe('the note’s words, heard by every page and counter showing them (the split)', () => {
  it('tells each listener, and stops telling one that stopped', () => {
    const count = new WordCount();
    const first: number[] = [];
    const second: number[] = [];
    count.onCounted((words) => first.push(words));
    const stop = count.onCounted((words) => second.push(words));
    count.show('Snow on the walls.');
    stop();
    count.show('Snow.');
    expect(first).toEqual([4, 1]);
    expect(second).toEqual([4]);
  });

  it('tells what was written to each listener, once a stretch of writing is counted', () => {
    const count = new WordCount();
    const heard: number[][] = [[], []];
    count.onWrote((added) => heard[0]?.push(added));
    count.onWrote((added) => heard[1]?.push(added));
    count.show('Snow.');
    count.edited('Snow on the walls.', true);
    count.flush();
    expect(heard).toEqual([[3], [3]]);
  });
});

describe('the same note typed in on the other page', () => {
  it('follows its words without counting them as this page’s writer’s', () => {
    const count = new WordCount();
    const added: number[] = [];
    count.onWrote((words) => added.push(words));
    count.show('Snow.');
    count.echoed('Snow on the walls.'); // typed on the other page, counted there
    count.edited('Snow on the walls. Then rain.', true); // typed here
    count.flush();
    expect(added).toEqual([2]);
    expect(count.words).toBe(6);
  });

  it('counts what was typed here before the other page’s words came', () => {
    const count = new WordCount();
    const added: number[] = [];
    count.onWrote((words) => added.push(words));
    count.show('Snow.');
    count.edited('Snow fell.', true);
    count.echoed('Snow fell. On the walls.');
    count.flush();
    expect(added).toEqual([1]);
    expect(count.words).toBe(5);
  });
});
