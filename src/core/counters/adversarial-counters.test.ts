// Adversarial: phase 9b's rules — today's tally, a sprint, and a book's word
// goal in .eien-folder.json — against hostile stored values, odd clocks and
// a folder that changed under the goal field. A comment on a test describes
// the defect it caught, as it was before the fix.

import { describe, expect, it } from 'vitest';
import { parseFolderSettings, withFolderSettings } from '../vault';
import {
  clock,
  dayOf,
  readSprint,
  readTally,
  signed,
  sprintLeft,
  startSprint,
  tallied,
  todayWords,
} from './index';

describe('a book’s word goal in .eien-folder.json', () => {
  it('never makes a folder a book by taking away a goal it no longer has', () => {
    // withFolderSettings sets `book` to what's left of it whenever `goal` is in the change: an
    // empty Word goal… field, Entered after the folder stopped being a book (Not a book, or
    // another device's .eien-folder.json), writes "book": {} and makes it a book again.
    const notABook = '{\n  "order": ["Tear.md", "Mend.md"]\n}\n';
    const written = withFolderSettings(notABook, { goal: null });
    expect(written).not.toBeNull();
    expect(JSON.parse(written ?? '{}')).toEqual({ order: ['Tear.md', 'Mend.md'] });
    expect(parseFolderSettings(written).book).toBeNull();
    // A folder with no settings file at all gets one that makes it a book.
    expect(parseFolderSettings(withFolderSettings(null, { goal: null })).book).toBeNull();
  });

  it('keeps the book’s other keys, and the folder’s, when its goal changes', () => {
    const text = '{"order":["A.md"],"book":{"goal":40000,"subtitle":"x"},"other":1}';
    expect(JSON.parse(withFolderSettings(text, { goal: 90_000 }) ?? '{}')).toEqual({
      order: ['A.md'],
      book: { goal: 90_000, subtitle: 'x' },
      other: 1,
    });
    expect(JSON.parse(withFolderSettings(text, { goal: null }) ?? '{}')).toEqual({
      order: ['A.md'],
      book: { subtitle: 'x' },
      other: 1,
    });
  });

  it('reads a goal that isn’t a whole number of words, more than none, as no goal — still a book', () => {
    for (const goal of ['"90000"', '0', '-5', '1.5', '1e21', 'null', 'true', '[90000]', '{}']) {
      expect(parseFolderSettings(`{"book":{"goal":${goal}}}`), goal).toEqual({
        order: [],
        book: {},
      });
    }
    expect(parseFolderSettings('{"book":{"goal":90000}}').book).toEqual({ goal: 90_000 });
  });
});

describe('today’s tally against odd clocks and stored values', () => {
  it('reads back no tally whose words are past what a number holds exactly', () => {
    expect(readTally({ day: '2026-10-20', words: Number.MAX_SAFE_INTEGER + 1 })).toBeNull();
    expect(readTally({ day: '2026-10-20', words: Number.NaN })).toBeNull();
    expect(readTally({ day: '2026-10-20', words: Number.POSITIVE_INFINITY })).toBeNull();
    expect(readTally({ day: ' 2026-10-20', words: 1 })).toBeNull();
  });

  it('counts nothing today from a tally dated another day, before or after', () => {
    const now = new Date(2026, 9, 20, 12);
    expect(todayWords({ day: '2026-10-21', words: 500 }, now)).toBe(0);
    expect(todayWords({ day: '2026-10-19', words: 500 }, now)).toBe(0);
    expect(tallied({ day: '2026-10-21', words: 500 }, now, 3)).toEqual({
      day: '2026-10-20',
      words: 3,
    });
  });

  it('turns over at local midnight on the days the clocks change', () => {
    // Whatever the zone the tests run in, a day is the local calendar day.
    expect(dayOf(new Date(2026, 2, 29, 23, 59, 59))).toBe('2026-03-29');
    expect(dayOf(new Date(2026, 2, 30, 0, 0, 0))).toBe('2026-03-30');
    expect(dayOf(new Date(2026, 10, 1, 23, 59, 59))).toBe('2026-11-01');
    expect(dayOf(new Date(2026, 10, 2, 0, 0, 0))).toBe('2026-11-02');
  });

  it('signs nothing for nothing, and never shows "-0"', () => {
    expect(signed(-0)).toBe('0');
    expect(signed(-1_234_567)).toBe('−1,234,567');
  });
});

describe('a sprint against stored values', () => {
  const now = Date.UTC(2026, 9, 20, 10);

  it('reads back no sprint of a length the menu doesn’t offer, or with words that aren’t whole', () => {
    const sprint = startSprint(now, 25);
    for (const bad of [
      { ...sprint, minutes: 25.5 },
      { ...sprint, minutes: '25' },
      { ...sprint, words: 1.5 },
      { ...sprint, ends: Number.MAX_VALUE },
      { ...sprint, ends: null },
      [sprint],
    ]) {
      expect(readSprint(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('shows an hour as minutes, and a sprint past its end as no time left', () => {
    expect(clock(60 * 60_000)).toBe('60:00');
    expect(sprintLeft(startSprint(now, 10), now + 11 * 60_000)).toBe(0);
  });
});
