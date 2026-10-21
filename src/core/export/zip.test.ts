import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { readZip } from '../../../tests/support/read-zip';
import { crc32, dosTime, utf8, zipStore } from './zip';

const DATE = new Date(2026, 9, 20, 16, 40, 3);

describe('crc32', () => {
  it('is the standard one (zlib’s, held to it in tests/zip-interop.test.ts)', () => {
    expect(crc32(new Uint8Array())).toBe(0);
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf4_3926);
  });
});

describe('utf8', () => {
  it('is TextEncoder’s, a lone surrogate included', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        expect([...utf8(text)]).toEqual([...new TextEncoder().encode(text)]);
      }),
    );
    expect([...utf8('\ud800')]).toEqual([0xef, 0xbf, 0xbd]);
  });
});

describe('dosTime', () => {
  it('keeps the local time to two seconds', () => {
    const [time, day] = dosTime(DATE);
    expect(time).toBe((16 << 11) | (40 << 5) | 1);
    expect(day).toBe((46 << 9) | (10 << 5) | 20);
  });

  it('starts at 1980, and an invalid date is its first day', () => {
    expect(dosTime(new Date(1975, 0, 1))).toEqual([0, 33]);
    expect(dosTime(new Date(Number.NaN))).toEqual([0, 33]);
  });
});

describe('zipStore', () => {
  it('holds each file, stored, in its order, read back by a strict reader', () => {
    const zip = zipStore(
      [
        { path: 'mimetype', data: 'application/epub+zip' },
        { path: 'OEBPS/ch 1.xhtml', data: '<p>“Café”</p>' },
        { path: 'bytes.bin', data: new Uint8Array([0, 255, 10]) },
      ],
      DATE,
    );
    const read = readZip(zip);
    expect(read.names).toEqual(['mimetype', 'OEBPS/ch 1.xhtml', 'bytes.bin']);
    expect(read.text('OEBPS/ch 1.xhtml')).toBe('<p>“Café”</p>');
    expect([...(read.files.get('bytes.bin') ?? [])]).toEqual([0, 255, 10]);
    // An EPUB's mimetype starts at byte 30 of the file, as readers look for it.
    expect(new TextDecoder().decode(zip.subarray(30, 38))).toBe('mimetype');
    expect(new TextDecoder().decode(zip.subarray(38, 58))).toBe('application/epub+zip');
  });

  it('marks a name as UTF-8 only when it isn’t ASCII', () => {
    const read = readZip(
      zipStore(
        [
          { path: 'a.txt', data: '' },
          { path: 'Café.txt', data: '' },
        ],
        DATE,
      ),
    );
    expect(read.flags.get('a.txt')).toBe(0);
    expect(read.flags.get('Café.txt')).toBe(0x0800);
  });

  it('is an empty archive with no files', () => {
    expect(readZip(zipStore([], DATE)).names).toEqual([]);
  });

  it('refuses two files at one path', () => {
    expect(() =>
      zipStore(
        [
          { path: 'a', data: '1' },
          { path: 'a', data: '2' },
        ],
        DATE,
      ),
    ).toThrow(/Two files/);
  });

  it('gives back whatever it was given', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 20, unit: 'grapheme' }),
            data: fc.oneof(fc.string({ unit: 'grapheme' }), fc.uint8Array({ maxLength: 64 })),
          }),
          { selector: (entry) => entry.path, maxLength: 6 },
        ),
        (entries) => {
          const read = readZip(zipStore(entries, DATE));
          expect(read.names).toEqual(entries.map((entry) => entry.path));
          for (const entry of entries) {
            const data =
              typeof entry.data === 'string' ? new TextEncoder().encode(entry.data) : entry.data;
            expect([...(read.files.get(entry.path) ?? [])]).toEqual([...data]);
          }
        },
      ),
    );
  });
});
