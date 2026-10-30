import { describe, expect, it } from 'vitest';
import { parseReading, readingKept, readingPath, withReading } from './reading';

describe('the reading state’s file', () => {
  it('lives in .eien/reading, named by the book’s key', () => {
    expect(readingPath('0123456789abcdef')).toBe('.eien/reading/0123456789abcdef.json');
  });

  it('reads the chapter last open; nothing from no file, or one that isn’t an object', () => {
    expect(parseReading('{ "version": 1, "chapter": "OEBPS/chapter-2.xhtml" }')).toEqual({
      chapter: 'OEBPS/chapter-2.xhtml',
      offset: 0,
    });
    for (const text of [null, '', 'not json', '[1]', '{"chapter": 3}', '{"chapter": ""}']) {
      expect(parseReading(text), String(text)).toEqual({ chapter: null, offset: 0 });
    }
    expect(parseReading('﻿{"chapter": "a"}')).toEqual({ chapter: 'a', offset: 0 });
  });

  it('reads the place in the chapter only beside the chapter it names', () => {
    const file = (place: unknown) => JSON.stringify({ version: 1, chapter: 'b', place });
    expect(parseReading(file({ chapter: 'b', offset: 1234 }))).toEqual({
      chapter: 'b',
      offset: 1234,
    });
    // An Eien from before places changed the chapter and kept the old place.
    expect(parseReading(file({ chapter: 'a', offset: 1234 })).offset).toBe(0);
    for (const offset of [-3, 1.5, '12', null, Number.MAX_SAFE_INTEGER + 2]) {
      expect(parseReading(file({ chapter: 'b', offset })).offset, String(offset)).toBe(0);
    }
    for (const place of [null, 7, 'b', [1], {}]) {
      expect(parseReading(file(place)).offset, JSON.stringify(place)).toBe(0);
    }
  });

  it('writes version 1 and keeps every field it doesn’t know', () => {
    const text = withReading(
      '{ "version": 1, "chapter": "a", "bookmarks": [1, 2], "place": { "chapter": "a", "offset": 3 } }',
      { chapter: 'b', offset: 40 },
    ) as string;
    expect(JSON.parse(text)).toEqual({
      version: 1,
      chapter: 'b',
      bookmarks: [1, 2],
      place: { chapter: 'b', offset: 40 },
    });
    expect(text.endsWith('}\n')).toBe(true);
    // No file, or an empty one, begins anew.
    expect(JSON.parse(withReading('', { chapter: 'c', offset: 0 }) as string)).toEqual({
      version: 1,
      chapter: 'c',
      place: { chapter: 'c', offset: 0 },
    });
    expect(parseReading(withReading(null, { chapter: 'd', offset: 9 }))).toEqual({
      chapter: 'd',
      offset: 9,
    });
  });

  it('never writes over a file it can’t read: its bookmarks stay until it’s fixed or deleted (Phase 4b)', () => {
    for (const text of ['not json', '[1]', '{"bookmarks": [', '"a"'])
      expect(withReading(text, { chapter: 'c', offset: 0 }), text).toBeNull();
    expect(readingKept('not json')).toBe('unreadable');
    expect(readingKept(null)).toBe('none');
    expect(readingKept('{"version": 1}')).toBe('kept');
    expect(readingKept('{"version": 2}')).toBe('newer');
  });

  it('never writes over a file a newer Eien wrote, and still reads what it can', () => {
    const newer = '{ "version": 2, "chapter": "a", "place": "somewhere new" }';
    expect(withReading(newer, { chapter: 'b', offset: 0 })).toBeNull();
    expect(parseReading(newer)).toEqual({ chapter: 'a', offset: 0 });
  });
});
