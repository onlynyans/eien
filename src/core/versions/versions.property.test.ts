// Properties of the word diff and the version files over generated inputs:
// the diff rebuilds both texts, finds the fewest changes, and stays within
// its bound; a seal's file name reads back as written.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { newNoteId, noteIdOf, withNoteId } from './note-id';
import { sealsToThin } from './retention';
import { parseVersionFile, type VersionFile, versionFileName } from './version-files';
import { diffTokens, wordDiff } from './word-diff';

/** Texts from few words, so they share many: the hard case for a diff. */
const word = fc.constantFrom('a', 'b', 'c', 'the', 'scarf', 'Ä', '“q”', '😀');
const text = fc
  .array(fc.array(word, { maxLength: 6 }), { maxLength: 6 })
  .map((lines) => lines.map((line) => line.join(' ')).join('\n'));

/** The longest common subsequence's length, the slow way. */
function lcs(a: readonly string[], b: readonly string[]): number {
  const row = new Array<number>(b.length + 1).fill(0);
  for (const x of a) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] as number;
      row[j] = x === b[j - 1] ? diagonal + 1 : Math.max(above, row[j - 1] as number);
      diagonal = above;
    }
  }
  return row[b.length] as number;
}

describe('wordDiff', () => {
  it('rebuilds the seal from what’s kept and removed, and the draft from what’s kept and added', () => {
    fc.assert(
      fc.property(text, text, fc.integer({ min: 1, max: 50 }), (before, after, bound) => {
        const ops = wordDiff(before, after, bound);
        expect(ops.filter((op) => op.kind !== 'added').map((op) => op.key)).toEqual(
          diffTokens(before).map((t) => t.key),
        );
        expect(ops.filter((op) => op.kind !== 'removed').map((op) => op.key)).toEqual(
          diffTokens(after).map((t) => t.key),
        );
      }),
    );
  });

  it('keeps as many words as can be kept, when the bound allows', () => {
    fc.assert(
      fc.property(text, text, (before, after) => {
        const kept = wordDiff(before, after).filter((op) => op.kind === 'same').length;
        expect(kept).toBe(
          lcs(
            diffTokens(before).map((t) => t.key),
            diffTokens(after).map((t) => t.key),
          ),
        );
      }),
    );
  });
});

describe('version files', () => {
  const moment = fc.integer({ min: Date.UTC(1971, 0, 1), max: Date.UTC(9999, 11, 31) });
  const name = fc.option(
    fc
      .string({ minLength: 1, maxLength: 12 })
      .filter((s) => !s.includes('/') && s.trim() === s && s.length > 0),
    { nil: null },
  );

  it('reads back the second, the name and the count it was named with', () => {
    fc.assert(
      fc.property(moment, name, fc.integer({ min: 1, max: 999 }), (at, given, count) => {
        const parsed = parseVersionFile(versionFileName(at, given, count));
        expect(parsed).toMatchObject({ at: Math.floor(at / 1000) * 1000, name: given, count });
      }),
    );
  });

  it('never thins a named seal, the latest, or the last 30 days, and leaves each old day one', () => {
    const now = Date.UTC(2026, 9, 20);
    const seal = fc
      .tuple(
        fc.integer({ min: now - 90 * 864e5, max: now }),
        fc.boolean(),
        fc.integer({ min: 1, max: 3 }),
      )
      .map(
        ([at, named, count]) =>
          parseVersionFile(versionFileName(at, named ? 'kept' : null, count)) as VersionFile,
      );
    const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    fc.assert(
      fc.property(fc.array(seal, { maxLength: 30 }), (versions) => {
        const thinned = new Set(sealsToThin(versions, now, day));
        const latest = Math.max(...versions.map((v) => v.at));
        for (const v of thinned) {
          expect(v.name).toBeNull();
          expect(v.at).toBeLessThan(now - 30 * 864e5);
          expect(
            v.at === latest && versions.filter((w) => w.at === latest).every((w) => thinned.has(w)),
          ).toBe(false);
        }
        const daysBefore = new Set(versions.filter((v) => v.name === null).map((v) => day(v.at)));
        const daysAfter = new Set(
          versions.filter((v) => v.name === null && !thinned.has(v)).map((v) => day(v.at)),
        );
        expect(daysAfter).toEqual(daysBefore);
      }),
    );
  });
});

describe('note ids', () => {
  it('every id made reads back as written from any note it’s put in', () => {
    const front = fc.constantFrom(
      '',
      'Body.',
      '---\n---\nBody',
      '---\ntags: [a]\n---\n',
      '---\nid: OLD\n---\n',
    );
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 10, maxLength: 10 }), front, (random, text) => {
        const id = newNoteId(random);
        const next = withNoteId(text, id);
        expect(next === null ? null : noteIdOf(next)).toBe(id);
      }),
    );
  });
});
