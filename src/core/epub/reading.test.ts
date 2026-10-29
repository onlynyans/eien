import { describe, expect, it } from 'vitest';
import { parseReading, readingPath, withReading } from './reading';

describe('the reading state’s file', () => {
  it('lives in .eien/reading, named by the book’s key', () => {
    expect(readingPath('0123456789abcdef')).toBe('.eien/reading/0123456789abcdef.json');
  });

  it('reads the chapter last open; nothing from no file, or one that isn’t an object', () => {
    expect(parseReading('{ "version": 1, "chapter": "OEBPS/chapter-2.xhtml" }')).toEqual({
      chapter: 'OEBPS/chapter-2.xhtml',
    });
    for (const text of [null, '', 'not json', '[1]', '{"chapter": 3}', '{"chapter": ""}']) {
      expect(parseReading(text), String(text)).toEqual({ chapter: null });
    }
    expect(parseReading('﻿{"chapter": "a"}')).toEqual({ chapter: 'a' });
  });

  it('writes version 1 and keeps every field it doesn’t know', () => {
    const text = withReading(
      '{ "version": 1, "chapter": "a", "bookmarks": [1, 2], "place": { "at": 3 } }',
      { chapter: 'b' },
    ) as string;
    expect(JSON.parse(text)).toEqual({
      version: 1,
      chapter: 'b',
      bookmarks: [1, 2],
      place: { at: 3 },
    });
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(withReading('not json', { chapter: 'c' }) as string)).toEqual({
      version: 1,
      chapter: 'c',
    });
    expect(parseReading(withReading(null, { chapter: 'd' }))).toEqual({ chapter: 'd' });
  });

  it('never writes over a file a newer Eien wrote, and still reads what it can', () => {
    const newer = '{ "version": 2, "chapter": "a", "place": "somewhere new" }';
    expect(withReading(newer, { chapter: 'b' })).toBeNull();
    expect(parseReading(newer)).toEqual({ chapter: 'a' });
  });
});
