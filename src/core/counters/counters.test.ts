import { describe, expect, it } from 'vitest';
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

const at = (iso: string) => new Date(iso);

describe('today’s words', () => {
  it('counts the day on this device’s clock', () => {
    expect(dayOf(new Date(2026, 9, 20, 23, 59))).toBe('2026-10-20');
    expect(dayOf(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
  });

  it('adds what’s written, takes off what’s cut, and starts again on a new day', () => {
    const morning = new Date(2026, 9, 20, 9);
    let tally = tallied(null, morning, 120);
    tally = tallied(tally, morning, -20);
    expect(todayWords(tally, morning)).toBe(100);
    expect(tallied(tally, morning, -150).words).toBe(-50); // net: cutting more than was written
    const tomorrow = new Date(2026, 9, 21, 0, 1);
    expect(todayWords(tally, tomorrow)).toBe(0);
    expect(tallied(tally, tomorrow, 7)).toEqual({ day: '2026-10-21', words: 7 });
  });

  it('reads back only a tally', () => {
    expect(readTally({ day: '2026-10-20', words: 9 })).toEqual({ day: '2026-10-20', words: 9 });
    expect(readTally({ day: '2026-10-20', words: -3 })).toEqual({ day: '2026-10-20', words: -3 });
    for (const bad of [
      null,
      'x',
      [],
      { day: 'today', words: 1 },
      { day: '2026-10-20', words: 1.5 },
      { day: '2026-10-20', words: '9' },
      { day: '2026-10-20' },
    ]) {
      expect(readTally(bad)).toBeNull();
    }
  });

  it('shows a count with its sign', () => {
    expect(signed(809)).toBe('+809');
    expect(signed(12_345)).toBe('+12,345');
    expect(signed(-12)).toBe('−12');
    expect(signed(0)).toBe('0');
  });
});

describe('a sprint', () => {
  const now = at('2026-10-20T10:00:00Z').getTime();

  it('ends after its minutes, its time left a clock that never goes below nothing', () => {
    const sprint = startSprint(now, 25);
    expect(sprint).toEqual({ ends: now + 25 * 60_000, minutes: 25, words: 0 });
    expect(clock(sprintLeft(sprint, now))).toBe('25:00');
    expect(clock(sprintLeft(sprint, now + 1))).toBe('25:00'); // a part second is a whole one
    expect(clock(sprintLeft(sprint, now + 60_000 * 24 + 55_500))).toBe('0:05');
    expect(sprintLeft(sprint, now + 26 * 60_000)).toBe(0);
    expect(clock(0)).toBe('0:00');
  });

  it('reads back only a sprint of a length the menu offers', () => {
    const sprint = startSprint(now, 15);
    expect(readSprint(JSON.parse(JSON.stringify(sprint)))).toEqual(sprint);
    for (const bad of [null, {}, { ...sprint, minutes: 7 }, { ...sprint, ends: 'soon' }]) {
      expect(readSprint(bad)).toBeNull();
    }
  });
});
