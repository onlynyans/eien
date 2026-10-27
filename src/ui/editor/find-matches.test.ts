import { SearchQuery } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { COUNT_LIMIT } from '../../core/find';
import { countMatches, firstMatchFrom } from './find-matches';

const at = (doc: string, from = 0, to = from) =>
  EditorState.create({ doc, selection: { anchor: from, head: to } });
const query = (search: string, more: Partial<ConstructorParameters<typeof SearchQuery>[0]> = {}) =>
  new SearchQuery({ search, literal: true, ...more });

describe('counting matches', () => {
  it('counts them, and which the selection is on', () => {
    expect(countMatches(at('a b a b a', 4, 5), query('a'))).toEqual({
      current: 2,
      total: 3,
      more: false,
    });
  });

  it('is on none when the selection isn’t a match', () => {
    expect(countMatches(at('a b a', 1), query('a'))).toEqual({ current: 0, total: 2, more: false });
  });

  it('counts nothing for nothing typed, and says when a pattern can’t be read', () => {
    expect(countMatches(at('a'), query(''))).toEqual({ current: 0, total: 0, more: false });
    expect(countMatches(at('a'), query('(a', { regexp: true }))).toBe('invalid');
  });

  it('stops at the limit', () => {
    const many = 'e'.repeat(COUNT_LIMIT + 5);
    expect(countMatches(at(many), query('e'))).toEqual({
      current: 0,
      total: COUNT_LIMIT,
      more: true,
    });
  });
});

describe('the first match from the caret', () => {
  it('is the one at or after it', () => {
    expect(firstMatchFrom(at('bell, bell'), query('bell'), 0)).toEqual({ from: 0, to: 4 });
    expect(firstMatchFrom(at('bell, bell'), query('bell'), 1)).toEqual({ from: 6, to: 10 });
  });

  it('comes round to the note’s first when there’s none after', () => {
    expect(firstMatchFrom(at('bell, gong'), query('bell'), 7)).toEqual({ from: 0, to: 4 });
  });

  it('is none for no match, or a pattern that can’t be read', () => {
    expect(firstMatchFrom(at('gong'), query('bell'), 0)).toBeNull();
    expect(firstMatchFrom(at('gong'), query('(', { regexp: true }), 0)).toBeNull();
  });
});
