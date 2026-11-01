import { describe, expect, it } from 'vitest';
import { countWords, escapePattern, FIND_COMMANDS, findKey } from '.';

describe('the find bar’s count', () => {
  it('says nothing with nothing typed', () => {
    expect(countWords('', { current: 0, total: 0, more: false })).toBe('');
  });

  it('says which match of how many', () => {
    expect(countWords('bell', { current: 3, total: 12, more: false })).toBe('3 of 12');
    expect(countWords('bell', { current: 1, total: 1200, more: false })).toBe('1 of 1,200');
  });

  it('says how many when the selection is on none of them', () => {
    expect(countWords('bell', { current: 0, total: 12, more: false })).toBe('12 matches');
    expect(countWords('bell', { current: 0, total: 1, more: false })).toBe('1 match');
  });

  it('says there are none, and when a pattern can’t be read', () => {
    expect(countWords('bell', { current: 0, total: 0, more: false })).toBe('No matches');
    expect(countWords('(bell', 'invalid')).toBe('Not a valid pattern');
  });

  it('stops counting at the limit, and says so', () => {
    expect(countWords('e', { current: 4, total: 1000, more: true })).toBe('4 of 1,000+');
    expect(countWords('e', { current: 0, total: 1000, more: true })).toBe('1,000+ matches');
  });
});

describe('find’s keys', () => {
  it('are ⌘F, ⌥⌘F, ⌘G and ⇧⌘G on a Mac', () => {
    expect(['find', 'replace', 'next', 'previous'].map((id) => findKey(id as never, true))).toEqual(
      ['Mod-f', 'Mod-Alt-f', 'Mod-g', 'Mod-Shift-g'],
    );
  });

  it('take no Ctrl+Alt key off the Mac, where that is AltGr and types a letter', () => {
    expect(findKey('replace', false)).toBe('Ctrl-h');
    const letters = FIND_COMMANDS.map((command) => findKey(command.id, false)).filter((key) =>
      /^(Mod|Ctrl)-Alt-.$/.test(key),
    );
    expect(letters).toEqual([]);
  });

  it('are each a different key', () => {
    for (const mac of [true, false]) {
      const keys = FIND_COMMANDS.map((command) => findKey(command.id, mac));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('words as a pattern', () => {
  it('escapes what a pattern reads as more than itself, and reads back as the words, even under u', () => {
    const words = 'a.b*c+d?(e)[f]{g}|h/i\\j^k$l-m';
    const pattern = new RegExp(`^${escapePattern(words)}$`, 'u');
    expect(pattern.test(words)).toBe(true);
    expect(pattern.test('aXb*c+d?(e)[f]{g}|h/i\\j^k$l-m')).toBe(false);
  });
});

describe('the count while a book is searched', () => {
  it('says it’s searching, not that there are none, while it hasn’t found one yet', () => {
    expect(countWords('bell', { current: 0, total: 0, more: false, searching: true })).toBe(
      'Searching…',
    );
    expect(countWords('bell', { current: 0, total: 0, more: false, searching: false })).toBe(
      'No matches',
    );
  });
});
