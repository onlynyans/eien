// Eien's zips (src/core/export/zip.ts) as other programs read them: its CRC
// is zlib's, and unzip finds nothing wrong, where the system has unzip
// (macOS and Linux; CI's unit tests run on Linux).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32 as zlibCrc32 } from 'node:zlib';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { docx, epub } from '../src/core/export';
import { crc32, zipStore } from '../src/core/export/zip';

const unzip = (() => {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('zips, as other programs read them', () => {
  it('CRC-32 is zlib’s', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), (bytes) => {
        expect(crc32(bytes)).toBe(zlibCrc32(bytes));
      }),
    );
  });

  it.skipIf(!unzip)('unzip finds nothing wrong: a zip, an EPUB, a Word file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eien-zip-'));
    const request = {
      title: 'Café',
      notes: [{ title: 'Été', markdown: 'Words[^1].\n\n[^1]: A note.' }],
      book: true,
      quotes: 'curly' as const,
      language: 'fr-FR',
      key: 'k',
      date: new Date(2026, 9, 20),
    };
    try {
      const files = {
        'test.zip': zipStore([{ path: 'Été/note.md', data: 'é' }], new Date()),
        'book.epub': epub(request),
        'book.docx': docx(request),
      };
      for (const [name, data] of Object.entries(files)) {
        const file = join(dir, name);
        writeFileSync(file, data);
        expect(execFileSync('unzip', ['-tq', file], { encoding: 'utf8' }), name).toMatch(
          /No errors detected/,
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
