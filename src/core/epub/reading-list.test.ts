import { describe, expect, it } from 'vitest';
import { type ListKind, listIn, withList } from './reading-list';

interface Item {
  readonly name: string;
}

/** A list of the test's own, as bookmarks and highlights are lists. */
const ITEMS: ListKind<Item> = {
  field: 'items',
  read: (item) =>
    typeof item === 'object' && item !== null && typeof (item as Item).name === 'string'
      ? { name: (item as Item).name }
      : null,
  same: (a, b) => a.name === b.name,
};

const keys = (text: string | null) => Object.keys(JSON.parse(text ?? '{}'));

describe('a list in the reading file', () => {
  it('reads the items it can, the first few', () => {
    const text = JSON.stringify({ version: 1, items: [{ name: 'a' }, 7, { name: 'b' }, {}] });
    expect(listIn(text, ITEMS, 10)).toEqual([{ name: 'a' }, { name: 'b' }]);
    expect(listIn(text, ITEMS, 1)).toEqual([{ name: 'a' }]);
    expect(listIn(JSON.stringify({ items: 'no' }), ITEMS, 10)).toEqual([]);
    expect(listIn(null, ITEMS, 10)).toEqual([]);
  });

  it('adds one, once, and takes one off, keeping what it can’t read and every field it doesn’t know', () => {
    const text = JSON.stringify({
      version: 1,
      items: [{ name: 'a', colour: 'red' }, 'later'],
      theirs: true,
    });
    const added = withList(text, ITEMS, { add: { name: 'b' } });
    expect(JSON.parse(added as string)).toEqual({
      version: 1,
      items: [{ name: 'a', colour: 'red' }, 'later', { name: 'b' }],
      theirs: true,
    });
    expect(withList(added, ITEMS, { add: { name: 'b' } })).toBe(added);
    const gone = withList(added, ITEMS, { remove: [{ name: 'a' }] });
    expect(JSON.parse(gone as string).items).toEqual(['later', { name: 'b' }]);
  });

  it('keeps each field where it stood, so a synced file changes only where it was changed', () => {
    const text = JSON.stringify({ version: 1, items: [], chapter: 'c.xhtml', theirs: 1 });
    expect(keys(withList(text, ITEMS, { add: { name: 'a' } }))).toEqual([
      'version',
      'items',
      'chapter',
      'theirs',
    ]);
  });

  it('writes the version this Eien writes, first in a file of its own', () => {
    expect(keys(withList(null, ITEMS, { add: { name: 'a' } }))).toEqual(['version', 'items']);
    const old = withList(JSON.stringify({ items: [], version: 0 }), ITEMS, {});
    expect(JSON.parse(old as string).version).toBe(1);
  });

  it('never writes over a newer Eien’s file, nor one it can’t read', () => {
    expect(withList(JSON.stringify({ version: 2 }), ITEMS, { add: { name: 'a' } })).toBeNull();
    expect(withList('{ not json', ITEMS, { add: { name: 'a' } })).toBeNull();
  });
});
