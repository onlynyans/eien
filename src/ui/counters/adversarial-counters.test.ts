// Adversarial: phase 9b's counters in the window — today's tally, a sprint,
// the note's words and what the writer's own changes add, and the book's
// words in the colophon — against the clock, a hostile store, quick note
// switches and the order the window does things in. Vitest runs in Node, so
// the few DOM calls these modules make (h(): createElement, textContent) and
// the window's localStorage are played by small stand-ins. A comment on a
// test describes the defect it caught, as it was before the fix.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { readWhole } from '../menu/ask-number';
import type { PageView } from '../page/page';
import { WordCount } from '../page/word-count';
import { counting } from '../vault/counting';
import type { OpenNote } from '../vault/open-note';
import { Organizer } from '../vault/organize';
import type { VaultState } from '../vault/vault-state';
import { Counters } from './counters';

/** Just enough of an element for h() and the counters' text. */
class FakeElement {
  textContent = '';
  className = '';
  readonly attributes = new Map<string, string>();
  readonly children: unknown[] = [];
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  addEventListener(): void {}
  append(...nodes: unknown[]): void {
    this.children.push(...nodes);
  }
}

/** The window's localStorage, in memory. */
function fakeStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, String(value)),
    removeItem: (key: string) => void items.delete(key),
  };
}

let storage = fakeStorage();

beforeEach(() => {
  storage = fakeStorage();
  vi.stubGlobal('document', { createElement: () => new FakeElement() });
  vi.stubGlobal('localStorage', storage);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const part = (counters: Counters, at: number) =>
  (counters.element as unknown as FakeElement).children[at] as FakeElement;
const today = (counters: Counters) => part(counters, 0).textContent;
const book = (counters: Counters) => part(counters, 1).textContent;
const sprint = (counters: Counters) => part(counters, 2).textContent;

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

describe('today’s words in the colophon', () => {
  it('starts again at midnight, though no sprint is running and nothing is typed', () => {
    // counters.ts only redraws Today on wrote() and on a sprint's tick: with no sprint, a window
    // left open overnight shows yesterday's tally as today's until the writer next types — the
    // writer sits down in the morning to "Today +500" and thinks the words are already written.
    vi.setSystemTime(new Date(2026, 9, 20, 23, 59, 0));
    storage.setItem('eien.today', JSON.stringify({ day: '2026-10-20', words: 500 }));
    const counters = new Counters({ tell: () => {} });
    expect(today(counters)).toBe('Today +500');
    vi.advanceTimersByTime(2 * 60_000); // 00:01, the next day
    expect(today(counters)).toBe('Today 0');
  });

  it('survives a store that refuses to be read or written, and still counts in the window', () => {
    vi.setSystemTime(new Date(2026, 9, 20, 9));
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    });
    const counters = new Counters({ tell: () => {} });
    expect(today(counters)).toBe('Today 0');
    counters.wrote(3);
    expect(today(counters)).toBe('Today +3');
    counters.startSprint(10);
    counters.stopSprint();
    expect(sprint(counters)).toBe('');
  });

  it('reads nothing from a stored value that is garbage, hostile or the wrong shape', () => {
    vi.setSystemTime(new Date(2026, 9, 20, 9));
    for (const raw of [
      '{',
      'null',
      '"Today +9"',
      '{"day":"2026-10-20","words":"9"}',
      '{"day":"2026-10-20","words":1e400}',
      '{"day":"2026-10-20","words":null}',
      '{"__proto__":{"day":"2026-10-20","words":9}}',
    ]) {
      storage.items.set('eien.today', raw);
      expect(today(new Counters({ tell: () => {} })), raw).toBe('Today 0');
    }
  });
});

describe('a sprint', () => {
  it('tells its news once, at its end, with the words gained in it; later words count today only', () => {
    vi.setSystemTime(new Date(2026, 9, 20, 10));
    const told: string[] = [];
    const counters = new Counters({ tell: (message) => told.push(message) });
    counters.startSprint(10);
    counters.wrote(41);
    vi.advanceTimersByTime(10 * 60_000 + 1_500);
    expect(told).toEqual(['The sprint is over: +41 words.']);
    expect(sprint(counters)).toBe('Sprint done +41');
    counters.wrote(5);
    vi.advanceTimersByTime(5 * 60_000);
    expect(told).toHaveLength(1);
    expect(sprint(counters)).toBe('Sprint done +41');
    expect(today(counters)).toBe('Today +46');
  });

  it('starts again from nothing when one is started while another runs', () => {
    vi.setSystemTime(new Date(2026, 9, 20, 10));
    const told: string[] = [];
    const counters = new Counters({ tell: (message) => told.push(message) });
    counters.startSprint(10);
    counters.wrote(30);
    vi.advanceTimersByTime(9 * 60_000);
    counters.startSprint(25);
    expect(sprint(counters)).toBe('Sprint 25:00 0');
    vi.advanceTimersByTime(2 * 60_000); // past where the first would have ended
    expect(told).toEqual([]);
    expect(vi.getTimerCount()).toBe(2); // one sprint's clock, not two; and the midnight one
  });

  it('leaves no clock running once the vault closes (Counters.stop)', () => {
    vi.setSystemTime(new Date(2026, 9, 20, 10));
    const told: string[] = [];
    const counters = new Counters({ tell: (message) => told.push(message) });
    counters.startSprint(10);
    counters.stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(11 * 60_000);
    expect(told).toEqual([]);
  });

  it('counts the words typed in its last moments, before the count’s pause has run out', () => {
    // WordCount reports writing only once typing pauses for 250 ms, and Counters.wrote adds it
    // to a sprint only if the sprint is still running *then*: the burst a writer types right up
    // to the bell — the point of a sprint — lands after the end and is left out of its total.
    vi.setSystemTime(new Date(2026, 9, 20, 10));
    const told: string[] = [];
    // Wired as ../vault/counting.ts wires them: when the words were written, and a flush at the end.
    const count = new WordCount();
    const counters = new Counters({
      tell: (message) => told.push(message),
      flushWriting: () => count.flush(),
    });
    count.onWrote((added, when) => counters.wrote(added, when));
    count.show(words(100));
    counters.startSprint(10);
    vi.advanceTimersByTime(10 * 60_000 - 5_000);
    // Typing steadily through the last five seconds: a word every 150 ms, no 250 ms pause.
    for (let typed = 1; typed <= 33; typed++) {
      count.edited(words(100 + typed), true);
      vi.advanceTimersByTime(150);
    }
    vi.advanceTimersByTime(2_000);
    expect(today(counters)).toBe('Today +33');
    expect(sprint(counters)).toBe('Sprint done +33');
    expect(told).toEqual(['The sprint is over: +33 words.']);
  });

  it('never shows more time left than its length, when the clock is set back an hour', () => {
    // sprintLeft is ends − now, unbounded: a clock set back (or corrected) mid-sprint makes a
    // 10-minute sprint count down from 70:00, and its words keep counting for an hour.
    const start = new Date(2026, 9, 20, 10).getTime();
    vi.setSystemTime(start);
    const counters = new Counters({ tell: () => {} });
    counters.startSprint(10);
    vi.setSystemTime(start - 60 * 60_000);
    vi.advanceTimersByTime(1_000);
    const left = /^Sprint (\d+):(\d\d) /u.exec(sprint(counters));
    expect(left, sprint(counters)).not.toBeNull();
    expect(Number(left?.[1]) * 60 + Number(left?.[2]), sprint(counters)).toBeLessThanOrEqual(600);
  });
});

describe('the note’s words, and what the writer adds', () => {
  const heard = (count: WordCount) => {
    const added: number[] = [];
    count.onWrote((n) => added.push(n));
    return added;
  };

  it('counts words typed just before another note is opened, for the note they were typed in', () => {
    const count = new WordCount();
    const added = heard(count);
    count.show('One two three.');
    count.edited('One two three four five.', true);
    count.show(words(400)); // another note, inside the pause
    vi.advanceTimersByTime(1_000);
    expect(added).toEqual([2]);
    expect(count.words).toBe(400);
  });

  it('counts the writer’s pending words, and not the restore or reload that comes in on top of them', () => {
    const count = new WordCount();
    const added = heard(count);
    count.show(words(10));
    count.edited(words(12), true); // typed
    count.edited(words(3), false); // a restore, inside the pause
    count.edited(words(4), true); // typed again
    vi.advanceTimersByTime(300);
    expect(added).toEqual([2, 1]);
    count.show(words(50)); // a reload from another device
    expect(added).toEqual([2, 1]);
  });

  it('counts what was typed when the note closes (trashed, deleted elsewhere)', () => {
    const count = new WordCount();
    const added = heard(count);
    count.show(words(5));
    count.edited(words(9), true);
    count.clear();
    expect(added).toEqual([4]);
    expect(count.words).toBe(0);
  });
});

describe('the book in the colophon', () => {
  it('never shows the last book’s words once a note outside it is on the page', async () => {
    // counting.ts's show() runs on every count — including the new note's first one, from
    // page.show — with `book` still the last note's, until the redraw's sync() has read the new
    // note's folder over IPC. Meanwhile the colophon names the old book with a made-up total
    // (its words, less its chapter, plus the new note's): "Book 903 / 90,000" for a loose note.
    const page = { counters: () => {}, words: new WordCount() };
    let path = 'Scarf/Tear.md';
    const state = {
      bookOf: async (at: string) =>
        at.startsWith('Scarf/') ? { words: 1_000, note: 100, goal: 90_000 } : null,
    };
    const counts = counting({
      page: page as unknown as PageView,
      note: () => ({ path }) as OpenNote,
      state: state as unknown as VaultState,
      tell: () => {},
    });
    page.words.show(words(100));
    await counts.sync();
    expect(book(counts.counters)).toBe('Book 1,000 / 90,000');

    path = 'Loose.md';
    page.words.show('One two three.'); // page.show, before the redraw
    expect(book(counts.counters)).toBe('');
    await counts.sync();
    expect(book(counts.counters)).toBe('');
  });
});

describe('a book’s word goal, set', () => {
  it('never brings back a folder that went away while its goal field was open', async () => {
    // setGoal writes .eien-folder.json at the path the menu was opened for; writes make their
    // folders, so a book renamed, moved or trashed meanwhile (another device) comes back as an
    // empty folder that is a book, beside the real one.
    const storage = new MemoryStorage();
    storage.put('Scarf/.eien-folder.json', '{"book":{"goal":40000}}');
    storage.put('Scarf/Tear.md', 'The scarf caught on the gate.');
    const organizer = new Organizer({
      vault: storage as unknown as ConstructorParameters<typeof Organizer>[0]['vault'],
      state: {} as VaultState,
      trashName: 'the trash',
      session: () => null,
      closed: () => {},
      tell: () => {},
    });
    // The field is open for "Scarf"; Syncthing brings in its rename to "Mended Scarf".
    expect((await storage.move('Scarf', 'Mended Scarf')).ok).toBe(true);
    await organizer.setGoal('Scarf', 90_000);
    expect(await storage.read('Scarf/.eien-folder.json')).toBeNull();
  });
});

describe('a book’s word goal, as typed', () => {
  it('reads thousands however they are marked, and refuses what is not a whole number', () => {
    expect(readWhole('90,000')).toBe(90_000);
    expect(readWhole('90.000')).toBe(90_000);
    expect(readWhole(' 90 000 ')).toBe(90_000);
    expect(readWhole('90’000')).toBe(90_000);
    expect(readWhole('90000')).toBe(90_000);
    for (const typed of ['', '  ', '1e5', '-5', '90k', 'lots', '0x10', '∞', '1/2']) {
      expect(readWhole(typed), typed).toBeNull();
    }
  });

  it('refuses a decimal rather than taking it for a number ten or a hundred times bigger', () => {
    // readWhole strips every "," "." and space wherever it stands, so "1.5" is 15 and "62,5" is
    // 625: a slip of the keyboard becomes a goal the writer never meant, with no refusal shown.
    for (const typed of ['1.5', '62,5', '90.5', '1,2,3', '9,0000', '45.000.0']) {
      expect(readWhole(typed), typed).toBeNull();
    }
  });
});
