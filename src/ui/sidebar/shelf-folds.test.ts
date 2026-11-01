import { beforeEach, describe, expect, it } from 'vitest';
import { readShelfFolds, ShelfFolds } from './shelf-folds';

beforeEach(() => localStorage.clear());

describe('SHELF’s folds (#40)', () => {
  it('starts every folder open, and keeps a shut one on this device', () => {
    const folds = new ShelfFolds();
    expect(folds.has('Novels')).toBe(false);
    folds.set('Novels', true);
    folds.set('Reading/Russian', true);
    expect(new ShelfFolds().shut).toEqual(['Novels', 'Reading/Russian']);
    folds.set('Novels', false);
    expect(new ShelfFolds().shut).toEqual(['Reading/Russian']);
  });

  it('follows a folder renamed or moved, and the folders in it, but not one whose name only starts the same', () => {
    const folds = new ShelfFolds();
    for (const path of ['Novels', 'Novels/Russian', 'Novels 2']) folds.set(path, true);
    folds.follow('Novels', 'Reading/Books');
    expect(new ShelfFolds().shut).toEqual(['Novels 2', 'Reading/Books', 'Reading/Books/Russian']);
  });

  it('forgets a folder trashed, and the folders in it', () => {
    const folds = new ShelfFolds();
    for (const path of ['Novels', 'Novels/Russian', 'Novels 2']) folds.set(path, true);
    folds.forget('Novels');
    expect(new ShelfFolds().shut).toEqual(['Novels 2']);
  });

  it('opens every folder down to one, so a folder moved into it shows', () => {
    const folds = new ShelfFolds();
    for (const path of ['A', 'A/B', 'A/B/C', 'Z']) folds.set(path, true);
    folds.openTo('A/B');
    expect(new ShelfFolds().shut).toEqual(['A/B/C', 'Z']);
  });

  it('shuts nothing for nothing stored, or anything it doesn’t know', () => {
    for (const text of [null, '', 'not json', '{}', '"Novels"', '[1, null, ""]']) {
      expect([...readShelfFolds(text)]).toEqual([]);
    }
    expect([...readShelfFolds('["Novels", 3]')]).toEqual(['Novels']);
  });
});
