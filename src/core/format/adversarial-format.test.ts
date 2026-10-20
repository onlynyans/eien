// Adversarial: the formatting commands on selections a writer makes every
// day in Live — across list items and headings, over words already marked
// separately, and in scripts whose letters carry combining marks.

import { describe, expect, it } from 'vitest';
import { apply, formatCommand } from './index';

const run = (id: string, text: string, from: number, to = from) => {
  const command = formatCommand(id);
  if (!command) throw new Error(id);
  return apply(text, command.run(text, { from, to }).changes);
};

describe('a mark over whole lines keeps each line what it was', () => {
  it.each([
    ['bold', '- one\n- two', '- **one**\n- **two**'],
    ['bold', '# Title\nText', '# **Title**\n**Text**'],
    ['italic', '> He drapes it.', '> *He drapes it.*'],
    ['strike', '- [ ] Summary', '- [ ] ~~Summary~~'],
  ])('%s over %j', (id, text, after) => {
    expect(run(id, text, 0, text.length)).toBe(after);
  });
});

describe('a mark over words already marked one by one', () => {
  it.each([
    ['bold', '**a** and **b**'],
    ['italic', '*a* and *b*'],
    ['highlight', '==a== and ==b=='],
  ])('%s over %j leaves no stray marks', (id, text) => {
    const after = run(id, text, 0, text.length);
    // Either all of it marked, or all of it plain; never "a** and **b".
    expect(['a and b', '**a and b**', '*a and b*', '==a and b==']).toContain(
      after.replace(/\*\*\*\*|====/g, ''),
    );
  });
});

describe('the word around the caret is the whole word', () => {
  it.each([
    // Hindi: vowel signs and the virama are combining marks inside the word.
    ['हिन्दी', 3, '**हिन्दी**'],
    // Thai: the vowel and tone marks above are combining marks.
    ['ที่นี่ ดี', 3, '**ที่นี่** ดี'],
    // A decomposed é (as macOS file names and some pasted text have it).
    ['Café au lait', 2, '**Café** au lait'],
  ])('bold with the caret in %j', (text, caret, after) => {
    expect(run('bold', text, caret)).toBe(after);
  });
});

// Found by the property tests (format.property.test.ts): marks the editor's
// parser can't read, so their stars show on the page.

describe('a mark goes where the parser reads it', () => {
  it.each([
    // "**" between a letter and "," can't open: the selection's ends move in to the words.
    ['bold', 'a永, aりa', 2, 5, 'a永, **a**りa'],
    // Japanese has no spaces: a quote's brackets stay outside, or the stars show.
    ['bold', '彼は「こんにちは」と言った', 2, 9, '彼は「**こんにちは**」と言った'],
    ['strike', 'x(one)y', 1, 6, 'x(~~one~~)y'],
    // Over several lines, a line's part with no word in it is left as it is.
    ['bold', 'one\n(two', 0, 5, '**one**\n(two'],
  ])('%s over %j', (id, text, from, to, after) => {
    expect(run(id, text, from, to)).toBe(after);
  });

  it('and pressed again, takes it off', () => {
    const command = formatCommand('italic');
    if (!command) throw new Error('italic');
    const once = command.run('a永, aりa', { from: 2, to: 5 });
    const marked = apply('a永, aりa', once.changes);
    expect(apply(marked, command.run(marked, once.selection).changes)).toBe('a永, aりa');
  });
});
