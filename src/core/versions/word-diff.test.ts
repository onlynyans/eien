import { describe, expect, it } from 'vitest';
import { diffCounts, diffLines, diffTokens, LINE_END, wordDiff } from './word-diff';

/** The lines as shown, a change marked -[removed] or +[added], the space after it outside. */
const shown = (before: string, after: string) =>
  diffLines(wordDiff(before, after)).map((line) =>
    line
      .map((run) => {
        if (run.kind === 'same') return run.text;
        const words = run.text.trimEnd();
        return `${run.kind === 'added' ? '+' : '-'}[${words}]${run.text.slice(words.length)}`;
      })
      .join(''),
  );

describe('diffTokens', () => {
  it('finds words as the word count does, punctuation on its own, and ends each line', () => {
    const tokens = diffTokens('One  two, three\n\n  Four\t \n');
    expect(tokens.map((t) => t.key)).toEqual([
      'One',
      'two',
      ',',
      'three',
      LINE_END,
      'Four',
      LINE_END,
    ]);
    expect(tokens.map((t) => t.text)).toEqual(['One  ', 'two', ', ', 'three', '', 'Four\t ', '']);
    expect(tokens.map((t) => t.word)).toEqual([true, true, false, true, false, true, false]);
    expect(diffTokens('')).toEqual([]);
  });

  it('finds the words of a language written without spaces', () => {
    const keys = diffTokens('她找到了一根针。').map((t) => t.key);
    expect(keys.length).toBeGreaterThan(3); // words, not the whole line
    expect(keys.join('')).toBe('她找到了一根针。\n');
  });
});

describe('wordDiff', () => {
  it('finds no changes in the same text, however it’s spaced', () => {
    expect(
      shown('The scarf tore.\n\nShe mended it.', 'The  scarf tore.\nShe mended it.\n'),
    ).toEqual(['The  scarf tore.', 'She mended it.']); // as the draft has it
    expect(diffCounts(wordDiff('a b', 'a b'))).toEqual({ removed: 0, added: 0 });
  });

  it('shows a word replaced as removed, then added, in its place', () => {
    expect(shown('The scarf tore on the gate.', 'The scarf caught on the gate.')).toEqual([
      'The scarf -[tore] +[caught] on the gate.',
    ]);
  });

  it('keeps a new sentence whole before an old one that starts the same', () => {
    expect(shown('The tension eased.', 'The welling faded. The tension eased.')).toEqual([
      '+[The welling faded.] The tension eased.',
    ]);
  });

  it('shows a sentence added after another as that sentence, its stop and all', () => {
    expect(shown('First. Second.', 'First. Second. Third.')).toEqual(['First. Second. +[Third.]']);
    expect(shown('A. B.', 'A. X. B.')).toEqual(['A. +[X.] B.']);
    expect(shown('First. Second. Third.', 'First. Third.')).toEqual(['First. -[Second.] Third.']);
  });

  it('shows a line added or removed whole, on its own', () => {
    expect(shown('One.\nTwo.', 'One.\nNew line here.\nTwo.')).toEqual([
      'One.',
      '+[New line here.]',
      'Two.',
    ]);
    expect(shown('One.\nGone line.\nTwo.', 'One.\nTwo.')).toEqual([
      'One.',
      '-[Gone line.]',
      'Two.',
    ]);
  });

  it('shows everything added to an empty seal, and everything removed from an emptied draft', () => {
    expect(shown('', 'Begin anywhere.')).toEqual(['+[Begin anywhere.]']);
    expect(shown('All gone.', '')).toEqual(['-[All gone.]']);
    expect(wordDiff('', '')).toEqual([]);
  });

  it('counts words, not line ends', () => {
    expect(diffCounts(wordDiff('a b c\nd', 'a x c\nd\ne f'))).toEqual({ removed: 1, added: 3 });
  });

  it('compares lines, then gives up, past its bound, still showing every word once', () => {
    const before = 'keep this line\nold words here\nalso keep';
    const after = 'keep this line\nnew text instead\nalso keep';
    // A bound of one change can't compare word by word, but can by lines.
    expect(shown(before, after).join('|')).toBe(
      'keep this line|-[old words here] +[new text instead]|also keep',
    );
    const ops = wordDiff('a b c', 'x y z', 1);
    expect(ops.filter((op) => op.kind !== 'added').map((op) => op.key)).toEqual(
      diffTokens('a b c').map((t) => t.key),
    );
    expect(ops.filter((op) => op.kind !== 'removed').map((op) => op.key)).toEqual(
      diffTokens('x y z').map((t) => t.key),
    );
  });

  it('compares a long chapter with a few changes quickly, and a rewrite of it within its bound', () => {
    const words = Array.from({ length: 20_000 }, (_, i) => `w${i % 997}`);
    const lines = (list: string[]) =>
      Array.from({ length: Math.ceil(list.length / 50) }, (_, i) =>
        list.slice(i * 50, i * 50 + 50).join(' '),
      ).join('\n');
    const edited = [...words];
    edited[5_000] = 'changed';
    edited.splice(12_000, 3);
    edited[edited.length - 1] = 'end';
    const started = performance.now();
    const counts = diffCounts(wordDiff(lines(words), lines(edited)));
    const small = performance.now() - started;
    expect(counts).toEqual({ removed: 5, added: 2 });
    // Every word rewritten: past the bound, by lines, then all removed and added.
    const rewrite = words.map((word) => `${word}x`);
    const begun = performance.now();
    expect(diffCounts(wordDiff(lines(words), lines(rewrite)))).toEqual({
      removed: 20_000,
      added: 20_000,
    });
    // Against the light edit on the same machine: the bound keeps a rewrite from taking far longer.
    expect(performance.now() - begun).toBeLessThan(Math.max(50, small) * 40);
  }, 60_000);
});

describe('diffLines', () => {
  it('runs the same, removed and added words together', () => {
    expect(diffLines(wordDiff('a b c d', 'a x y d'))).toEqual([
      [
        { kind: 'same', text: 'a ' },
        { kind: 'removed', text: 'b c ' },
        { kind: 'added', text: 'x y ' },
        { kind: 'same', text: 'd' },
      ],
    ]);
  });

  it('shows Chinese changed by the word, not the whole line', () => {
    // A needle (针) found, then scissors (剪刀) instead: the rest of the line is kept.
    const ops = wordDiff('她找到了一根针。', '她找到了一把剪刀。');
    const { removed, added } = diffCounts(ops);
    expect(removed).toBeGreaterThan(0);
    expect(added).toBeGreaterThan(0);
    const kept = ops.filter((op) => op.kind === 'same').map((op) => op.key);
    expect(kept.join('')).toContain('她找到了');
    // Bone (骨) put before the needle: one word added, none removed.
    expect(diffCounts(wordDiff('她找到了一根针。', '她找到了一根骨针。'))).toEqual({
      removed: 0,
      added: 1,
    });
  });

  it('joins two lines that the draft joined, and splits one the draft split', () => {
    expect(shown('a b\nc d', 'a b c d')).toEqual(['a b c d']);
    expect(shown('a b c d', 'a b\nc d')).toEqual(['a b', 'c d']);
  });
});
