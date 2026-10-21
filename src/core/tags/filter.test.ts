import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  filtering,
  NO_FILTER,
  nextState,
  passes,
  readFilter,
  stateOf,
  type TagFilter,
  withTagState,
} from './filter';

const filter = (tags: [string, 'in' | 'out'][], match: 'all' | 'any' = 'all'): TagFilter => ({
  tags,
  match,
});

describe('passes', () => {
  it('lets every note through with nothing chosen', () => {
    expect(passes([], NO_FILTER)).toBe(true);
    expect(passes(['draft'], NO_FILTER)).toBe(true);
    expect(filtering(NO_FILTER)).toBe(false);
  });

  it('wants all of the wanted tags, or any of them, as chosen', () => {
    const both = filter([
      ['posted', 'in'],
      ['fic', 'in'],
    ]);
    expect(passes(['posted', 'fic'], both)).toBe(true);
    expect(passes(['posted'], both)).toBe(false);
    expect(passes(['posted'], { ...both, match: 'any' })).toBe(true);
    expect(passes(['ideas'], { ...both, match: 'any' })).toBe(false);
  });

  it('keeps out a note with a kept-out tag, whatever else it has', () => {
    const f = filter([
      ['posted', 'in'],
      ['draft', 'out'],
    ]);
    expect(passes(['posted'], f)).toBe(true);
    expect(passes(['posted', 'draft'], f)).toBe(false);
    expect(passes(['draft'], filter([['draft', 'out']]))).toBe(false);
    expect(passes([], filter([['draft', 'out']]))).toBe(true);
  });

  it('counts a tag with the tags under it, and case aside', () => {
    expect(passes(['Fic/AOT'], filter([['fic', 'in']]))).toBe(true);
    expect(passes(['fic/aot'], filter([['fic', 'out']]))).toBe(false);
    expect(passes(['fiction'], filter([['fic', 'in']]))).toBe(false);
  });

  it('property: keeping a tag out never lets more notes through', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('a', 'b', 'c', 'a/x'), { maxLength: 4 }),
        fc.constantFrom('a', 'b', 'c'),
        (tags, out) => {
          const before = filter([['b', 'in']], 'any');
          const after = withTagState(before, out, 'out');
          if (passes(tags, after)) expect(passes(tags, before) || out === 'b').toBe(true);
        },
      ),
    );
  });
});

describe('choosing', () => {
  it('a press goes left alone → wanted → kept out → left alone; ⌥ keeps out at once', () => {
    expect(nextState(undefined)).toBe('in');
    expect(nextState('in')).toBe('out');
    expect(nextState('out')).toBeUndefined();
    expect(nextState(undefined, true)).toBe('out');
    expect(nextState('in', true)).toBe('out');
    expect(nextState('out', true)).toBeUndefined();
  });

  it('a tag keeps its place as its state changes, and leaves when left alone', () => {
    let f = withTagState(NO_FILTER, 'a', 'in');
    f = withTagState(f, 'b', 'in');
    f = withTagState(f, 'a', 'out');
    expect(f.tags).toEqual([
      ['a', 'out'],
      ['b', 'in'],
    ]);
    expect(stateOf(f, 'a')).toBe('out');
    expect(withTagState(f, 'a', undefined).tags).toEqual([['b', 'in']]);
  });
});

describe('readFilter', () => {
  it('reads a stored filter back, and nothing it can’t read', () => {
    const f = filter([['a', 'in']], 'any');
    expect(readFilter(JSON.parse(JSON.stringify(f)))).toEqual(f);
    expect(readFilter(null)).toEqual(NO_FILTER);
    expect(
      readFilter({ tags: [['a', 'maybe'], [1, 'in'], ['', 'in'], 'x'], match: 'some' }),
    ).toEqual(NO_FILTER);
    expect(
      readFilter({
        tags: [
          ['a', 'in'],
          ['a', 'out'],
        ],
      }).tags,
    ).toEqual([['a', 'out']]);
  });
});
