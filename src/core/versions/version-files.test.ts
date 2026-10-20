import { describe, expect, it } from 'vitest';
import { MAX_MADE_NAME_BYTES, utf8Length } from '../paths';
import {
  freeVersionFile,
  namedVersionFile,
  parseVersionFile,
  sortedVersions,
  versionFileName,
  versionStamp,
  versionsFolderOf,
} from './version-files';

const at = Date.UTC(2026, 9, 19, 16, 40, 2, 789);

describe('version files', () => {
  it('names a seal by its UTC second, as every system can store it', () => {
    expect(versionStamp(at)).toBe('2026-10-19T16-40-02Z');
    expect(versionFileName(at)).toBe('2026-10-19T16-40-02Z.md');
    expect(versionFileName(at, 'before the rewrite')).toBe(
      '2026-10-19T16-40-02Z--before the rewrite.md',
    );
    expect(versionFileName(at, null, 3)).toBe('2026-10-19T16-40-02Z~3.md');
    expect(versionsFolderOf('01JB2X4Q7Z')).toBe('.eien/versions/01JB2X4Q7Z');
  });

  it('is in UTC whatever the time zone: a seal at 23:30 in New York is the next day', () => {
    const newYorkLate = Date.UTC(2026, 11, 31, 4, 30, 0); // Dec 30, 23:30 in New York
    expect(versionStamp(newYorkLate)).toBe('2026-12-31T04-30-00Z');
  });

  it('reads back what it names, to the second', () => {
    const second = Math.floor(at / 1000) * 1000;
    expect(parseVersionFile('2026-10-19T16-40-02Z.md')).toEqual({
      file: '2026-10-19T16-40-02Z.md',
      at: second,
      name: null,
      count: 1,
    });
    expect(parseVersionFile('2026-10-19T16-40-02Z~2--a -- b.md')).toMatchObject({
      at: second,
      name: 'a -- b',
      count: 2,
    });
  });

  it('leaves alone a file that isn’t a seal, or names a day that doesn’t exist', () => {
    for (const file of [
      'notes.md',
      '2026-10-19T16-40-02Z.txt',
      '2026-10-19 16-40-02Z.md',
      '2026-02-30T10-00-00Z.md',
      '2026-13-01T10-00-00Z.md',
      '2026-10-19T24-00-00Z.md',
      '2026-10-19T16-40-02Z~0.md',
      '2026-10-19T16-40-02Z--.md',
      '.2026-10-19T16-40-02Z.md.eien.tmp',
    ]) {
      expect(parseVersionFile(file), file).toBeNull();
    }
    expect(parseVersionFile('2024-02-29T10-00-00Z.md')).not.toBeNull(); // a leap day
  });

  it('sorts newest first; a later seal in the same second before an earlier one', () => {
    const files = [
      '2026-10-19T16-40-02Z.md',
      'stray.md',
      '2026-10-19T16-40-02Z~2.md',
      '2025-12-31T23-59-59Z--last year.md',
      '2026-10-20T00-00-00Z.md',
    ];
    expect(sortedVersions(files).map((v) => v.file)).toEqual([
      '2026-10-20T00-00-00Z.md',
      '2026-10-19T16-40-02Z~2.md',
      '2026-10-19T16-40-02Z.md',
      '2025-12-31T23-59-59Z--last year.md',
    ]);
  });

  it('counts a second seal in the same second, named or not', () => {
    expect(freeVersionFile(at, [])).toBe('2026-10-19T16-40-02Z.md');
    expect(freeVersionFile(at, ['2026-10-19T16-40-02Z--named.md'])).toBe(
      '2026-10-19T16-40-02Z~2.md',
    );
    expect(freeVersionFile(at, ['2026-10-19T16-40-02Z.md', '2026-10-19T16-40-02Z~5.md'])).toBe(
      '2026-10-19T16-40-02Z~6.md',
    );
    expect(freeVersionFile(at, ['2026-10-19T16-40-03Z.md'])).toBe('2026-10-19T16-40-02Z.md');
  });

  it('names a seal with forbidden characters cleaned, and an empty name takes the name away', () => {
    const version = parseVersionFile('2026-10-19T16-40-02Z~2.md');
    if (!version) throw new Error('unread');
    expect(namedVersionFile(version, 'draft: v2 / final?')).toBe(
      '2026-10-19T16-40-02Z~2--draft v2 final.md',
    );
    expect(namedVersionFile(version, '   ')).toBe('2026-10-19T16-40-02Z~2.md');
    expect(namedVersionFile(version, 'CON')).toBe('2026-10-19T16-40-02Z~2--CON-.md');
    const named = parseVersionFile(namedVersionFile(version, 'draft: v2 / final?'));
    expect(named).toMatchObject({ at: version.at, count: 2, name: 'draft v2 final' });
  });

  it('cuts a long name so the file, and its temp file, fit', () => {
    const version = parseVersionFile('2026-10-19T16-40-02Z.md');
    if (!version) throw new Error('unread');
    const file = namedVersionFile(version, 'é'.repeat(300));
    expect(utf8Length(file)).toBeLessThanOrEqual(MAX_MADE_NAME_BYTES);
    expect(parseVersionFile(file)?.name).toMatch(/^é+$/);
  });
});
