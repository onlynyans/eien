import { describe, expect, it } from 'vitest';
import { readFolds, writeFolds } from './folds';

describe('readFolds', () => {
  it('reads back the sections that were folded', () => {
    expect([...readFolds(writeFolds(new Set(['folders', 'tags'])))].sort()).toEqual([
      'folders',
      'tags',
    ]);
    expect([...readFolds(writeFolds(new Set()))]).toEqual([]);
  });

  it('folds nothing for nothing stored, or anything it doesn’t know', () => {
    for (const text of [null, '', 'not json', '{}', '"folders"', '[1, null]', '{"folders":true}']) {
      expect([...readFolds(text)]).toEqual([]);
    }
  });

  it('keeps the sections it knows and drops the rest', () => {
    expect([...readFolds('["library", "results", "Folders", "library"]')]).toEqual(['library']);
  });
});
