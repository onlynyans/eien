// The tag field's menu (docs/design/explorations/tags.md): the vault's tags
// a note doesn't have, then "Make #…" for a new one.

import { describe, expect, it } from 'vitest';
import { tagChoices } from './choices';
import { buildTagTree } from './tree';

const tree = buildTagTree([
  { path: 'a.md', tags: ['fic/aot', 'posted', 'draft'] },
  { path: 'b.md', tags: ['fic', 'Ideas'] },
  { path: 'c.md', tags: ['ideas', 'research'] },
]);
const tags = (typed: string, has: string[] = []) =>
  tagChoices(tree, has, typed).map((choice) => (choice.made ? `make ${choice.tag}` : choice.tag));

describe('the tag field’s choices', () => {
  it('lists the vault’s tags in the tree’s order, nested ones too, with their counts', () => {
    expect(tags('')).toEqual(['draft', 'fic', 'fic/aot', 'Ideas', 'posted', 'research']);
    expect(tagChoices(tree, [], 'ideas')).toEqual([{ tag: 'Ideas', count: 2 }]);
  });

  it('leaves out the tags the note has, case aside', () => {
    expect(tags('', ['DRAFT', 'fic'])).toEqual(['fic/aot', 'Ideas', 'posted', 'research']);
  });

  it('holds what is typed, those that start with it first', () => {
    expect(tags('a')).toEqual(['draft', 'fic/aot', 'Ideas', 'research', 'make a']);
    expect(tags('i')).toEqual(['Ideas', 'fic', 'fic/aot', 'make i']);
    expect(tags('#Fi')).toEqual(['fic', 'fic/aot', 'make Fi']);
  });

  it('offers to make a tag no note has, never one there or one the note has', () => {
    expect(tags('ideas')).toEqual(['Ideas']);
    expect(tags('Draft', ['draft'])).toEqual([]);
    expect(tags('new/one')).toEqual(['make new/one']);
    expect(tags('12')).toEqual([]); // digits alone aren't a tag
    expect(tagChoices(tree, [], 'new').at(-1)).toEqual({ tag: 'new', count: 0, made: true });
  });

  it('lists eight at most, then the new one', () => {
    const many = buildTagTree([
      { path: 'm.md', tags: Array.from({ length: 12 }, (_, i) => `t${i}`) },
    ]);
    const shown = tagChoices(many, [], 't');
    expect(shown).toHaveLength(9);
    expect(shown.at(-1)?.made).toBe(true);
  });
});
