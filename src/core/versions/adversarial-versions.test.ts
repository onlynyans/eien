// Adversarial: the rules under seals (spec §2, §9) — ids in front matter
// another tool or a template wrote, seal file names from other devices and
// odd clocks, thinning across a time change, and the word diff on text that
// isn't English prose.

import { describe, expect, it } from 'vitest';
import { countPlainWords } from '../text';
import { noteIdOf, withNoteId } from './note-id';
import { sealsToThin } from './retention';
import {
  freeVersionFile,
  parseVersionFile,
  sortedVersions,
  type VersionFile,
  versionFileName,
} from './version-files';
import { diffCounts, diffTokens, wordDiff } from './word-diff';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const seal = (at: number, name: string | null = null, count = 1) =>
  parseVersionFile(versionFileName(at, name, count)) as VersionFile;

/** The lines of `a` that aren't in `b`, in order. */
const linesOnlyIn = (a: string, b: string) => {
  const others = new Set(b.split('\n'));
  return a.split('\n').filter((line) => !others.has(line));
};

describe('the word diff on text that isn’t spaced into words', () => {
  it('Chinese: one word changed is shown as that word, not the whole paragraph', () => {
    // The word count counts Chinese per word (core/text); Compare strikes the whole paragraph instead.
    const before = '我今天很高兴。他也很高兴。我们一起去公园散步，看见了很多花。';
    const after = '我今天很难过。他也很高兴。我们一起去公园散步，看见了很多花。';
    const ops = wordDiff(before, after);
    const kept = ops.filter((op) => op.kind === 'same' && op.key !== '\n').map((op) => op.key);
    expect(kept.join('')).toContain('我们一起去公园散步');
    const { removed, added } = diffCounts(ops);
    expect(removed).toBeLessThanOrEqual(countPlainWords('高兴'));
    expect(added).toBeLessThanOrEqual(countPlainWords('难过'));
  });

  it('hardening: emoji, right-to-left, no-break spaces and joiners rebuild both texts', () => {
    const before = 'שלום עולם 😀👩‍👩‍👧 Bonjour ! zero​width\nمرحبا بالعالم';
    const after = 'שלום עולם יפה 👩‍👩‍👧 Bonjour ? zero​width\nمرحبا';
    const ops = wordDiff(before, after);
    expect(ops.filter((op) => op.kind !== 'added').map((op) => op.key)).toEqual(
      diffTokens(before).map((t) => t.key),
    );
    expect(ops.filter((op) => op.kind !== 'removed').map((op) => op.key)).toEqual(
      diffTokens(after).map((t) => t.key),
    );
  });

  it('hardening: a 50,000-word note rewritten is compared in a bounded time', () => {
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    // Prose-like: a few words very common, most rare.
    const word = () => `w${Math.floor(next() ** 3 * 400)}`;
    const note = () =>
      Array.from({ length: 1000 }, () => Array.from({ length: 50 }, word).join(' ')).join('\n\n');
    const before = note();
    const after = note();
    let started = performance.now();
    const ops = wordDiff(before, after);
    const comparing = performance.now() - started;
    // Timed against reading the same words into tokens on the same machine, not against a
    // clock: CI's shared runners, under coverage, ran it fifteen times slower than a Mac and
    // failed a one-second limit. On a Mac it's 3 times the reading, 7 to 8 under coverage
    // (as CI runs it), where a bound six times as large made it over 50.
    started = performance.now();
    diffTokens(before);
    diffTokens(after);
    const reading = performance.now() - started;
    expect(comparing / reading).toBeLessThan(40);
    expect(ops.filter((op) => op.kind !== 'removed').map((op) => op.key)).toEqual(
      diffTokens(after).map((t) => t.key),
    );
  });
});

describe('hardening: ids in front matter others wrote', () => {
  it('changes only the id line, or nothing at all', () => {
    for (const front of [
      'id:\ntitle: Chapter', // a template's empty id
      'id: ~',
      'id:\tTABBED',
      'id : SPACED # kept',
      "id: 'quoted'",
      'id: &anchor ANCHORED',
      'id: A\nid: B', // two ids: which one is it?
      '"id": QUOTEDKEY',
      'title: "A\nid: FAKE"', // broken: an id inside an unclosed quote
      'summary: |\n  id: INSIDE\n  more\nid: REAL',
      'notes: >\n  id: FOLDED',
      `tags: [a, b]\n${'x: 1\n'.repeat(5000)}end: true`, // a huge front matter
    ]) {
      const text = `---\n${front}\n---\nBody.`;
      const next = withNoteId(text, 'NEWID12345');
      if (next === null) continue; // refused: nothing changed
      expect(noteIdOf(next), front).toBe('NEWID12345');
      expect(next.endsWith('\n---\nBody.'), front).toBe(true);
      // Every line but the id's is as it was.
      expect(linesOnlyIn(text, next).length, front).toBeLessThanOrEqual(1);
      expect(linesOnlyIn(next, text), front).toEqual(
        linesOnlyIn(next, text).filter((line) => line.startsWith('id: NEWID12345')),
      );
    }
  });

  it('never takes an id from a block of another key, and adds its own beside it', () => {
    const text = '---\nsummary: |\n  id: INSIDE\n---\nBody.';
    expect(noteIdOf(text)).toBeNull();
    expect(withNoteId(text, 'NEWID12345')).toBe(
      '---\nid: NEWID12345\nsummary: |\n  id: INSIDE\n---\nBody.',
    );
  });

  it('a note opening with a scene break holds no id, and gains front matter above it', () => {
    const text = '---\n\nThe night fell.';
    expect(noteIdOf(text)).toBeNull();
    const next = withNoteId(text, 'NEWID12345');
    expect(next).toBe('---\nid: NEWID12345\n---\n---\n\nThe night fell.');
    expect(noteIdOf(next ?? '')).toBe('NEWID12345');
  });
});

describe('hardening: seal file names from other devices and odd clocks', () => {
  it('reads only real moments: no leap second, no February 29th of a common year', () => {
    expect(parseVersionFile('2026-12-31T23-59-60Z.md')).toBeNull();
    expect(parseVersionFile('2026-02-29T00-00-00Z.md')).toBeNull();
    expect(parseVersionFile('2100-02-29T00-00-00Z.md')).toBeNull();
    expect(parseVersionFile('2400-02-29T00-00-00Z.md')).toMatchObject({
      at: Date.UTC(2400, 1, 29),
    });
    expect(parseVersionFile('2026-10-20T00-00-00Z~0.md')).toBeNull();
    expect(parseVersionFile('2026-10-20T00-00-00Z~1000000.md')).toBeNull();
    expect(parseVersionFile('0050-01-01T00-00-00Z.md')).toBeNull();
  });

  it('the next seal’s name is never one already there, named or counted, in the same second', () => {
    const at = NOW;
    const taken = [
      versionFileName(at),
      versionFileName(at, 'named', 2),
      versionFileName(at, null, 3),
      versionFileName(at, 'also named', 7),
      `${versionFileName(at).slice(0, -3)}~1.md`, // another tool's "~1"
    ];
    const free = freeVersionFile(at, taken);
    expect(taken).not.toContain(free);
    expect(parseVersionFile(free)).toMatchObject({ at, count: 8, name: null });
    expect(sortedVersions([...taken, free])[0]?.file).toBe(free);
  });
});

describe('hardening: thinning by the writer’s own days', () => {
  /** The day in New York, where clocks went back an hour on 2026-11-01. */
  const newYork = (at: number) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(at);

  it('keeps one seal for a day with an hour twice (clocks going back)', () => {
    // 01:30 EDT and 01:30 EST on 2026-11-01: one local day, an hour apart.
    const first = seal(Date.UTC(2026, 10, 1, 5, 30));
    const second = seal(Date.UTC(2026, 10, 1, 6, 30));
    const latest = seal(Date.UTC(2026, 11, 20));
    const now = Date.UTC(2026, 11, 20, 12);
    expect(newYork(first.at)).toBe(newYork(second.at));
    expect(sealsToThin([first, second, latest], now, newYork)).toEqual([first]);
  });

  it('keeps the latest seal even when another seal says it’s from the future', () => {
    const future = seal(Date.UTC(2099, 0, 1));
    const old = [seal(NOW - 40 * DAY), seal(NOW - 40 * DAY + 1000)];
    const recent = seal(NOW - DAY);
    const thinned = sealsToThin([future, ...old, recent], NOW, (at) =>
      new Date(at).toISOString().slice(0, 10),
    );
    expect(thinned).toEqual([old[0]]);
  });
});
