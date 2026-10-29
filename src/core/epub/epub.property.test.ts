// What holds for any book (#40): any bytes end in a book or a reason, never a
// throw and never past a cap; no address a book gives leaves its zip; UTF-8
// reads back as the system's decoder reads it.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { counted, handZip, zerosDeflate } from '../../../tests/support/epub-zip';
import { inflateRaw } from '../../platform/inflate';
import { EPUB_CAPS } from './caps';
import { openEpub } from './epub';
import { isRefusal } from './refusal';
import { fromUtf8 } from './utf8';
import { inZip, isZipPath } from './zip-path';
import { type Inflate, openZip } from './zip-read';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);
const plates = EPUBS['plates.epub'] as Uint8Array;

/** Everything a book offers, read: its chapters and pictures. */
async function readAll(bytes: Uint8Array, inflate: Inflate): Promise<void> {
  const book = await openEpub(bytes, inflate);
  if (isRefusal(book)) return;
  for (let i = 0; i < book.spine.length; i++) {
    const chapter = await book.chapter(i);
    if (isRefusal(chapter)) continue;
    for (const image of chapter.images) await book.image(image);
  }
}

describe('any bytes', () => {
  it('end in a book or a refusal, never a throw', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 2048 }), async (bytes) => {
        const book = await openEpub(bytes, inflateRaw);
        expect(isRefusal(book) || typeof book.title === 'string').toBe(true);
      }),
    );
  });

  it('a real book with any bytes changed still ends in a book or a refusal, never a throw', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(fc.nat({ max: plates.length - 1 }), fc.integer({ min: 0, max: 255 })), {
          minLength: 1,
          maxLength: 12,
        }),
        async (changes) => {
          const bytes = plates.slice();
          for (const [at, value] of changes) bytes[at] = value;
          await readAll(bytes, inflateRaw);
        },
      ),
    );
  });

  it('an entry whose header lies is never inflated past its declared size and a chunk', async () => {
    const lying = fc.record({
      zeros: fc.integer({ min: 1, max: 255 }).map((n) => 1 + 258 * n),
      declared: fc.nat({ max: 70_000 }),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(lying, { minLength: 1, maxLength: 4 }), async (entries) => {
        const bytes = handZip(
          entries.map(({ zeros, declared }, n) => ({
            name: `${n}`,
            data: new Uint8Array(zeros),
            method: 8 as const,
            packed: zerosDeflate(zeros),
            declared,
          })),
        );
        const zip = openZip(bytes, inflateRaw, { ...EPUB_CAPS, ratioFrom: Infinity });
        if (isRefusal(zip)) return;
        const { inflate, calls } = counted(inflateRaw);
        const read = openZip(bytes, inflate, { ...EPUB_CAPS, ratioFrom: Infinity });
        if (isRefusal(read)) return;
        for (const [n, { declared }] of entries.entries()) {
          const before = calls.length;
          await read.read(`${n}`, Infinity);
          const call = calls[before];
          if (call) expect(call.total - call.last).toBeLessThanOrEqual(declared);
        }
      }),
    );
  });

  it('a zip of any names and sizes opens only with clean names, within the caps', async () => {
    const entry = fc.record({
      name: fc.oneof(
        fc.string({ maxLength: 20 }),
        fc.constantFrom('../a', '/a', 'a/../../b', 'a\\b', 'C:/a', './a', 'a//b', 'ok/name.xhtml'),
      ),
      data: fc.uint8Array({ maxLength: 64 }),
      method: fc.constantFrom(0 as const, 8 as const),
      declared: fc.option(fc.nat({ max: 0xffff_ffff }), { nil: undefined }),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(entry, { maxLength: 6 }), async (entries) => {
        const zip = openZip(handZip(entries), inflateRaw);
        if (isRefusal(zip)) return;
        let total = 0;
        for (const each of zip.entries) {
          expect(isZipPath(each.name)).toBe(true);
          total += each.size;
          const read = await zip.read(each.name, EPUB_CAPS.text);
          if (!isRefusal(read)) expect(read.length).toBe(each.size);
        }
        expect(total).toBeLessThanOrEqual(EPUB_CAPS.total);
      }),
    );
  });
});

describe('addresses in a book', () => {
  const part = fc.oneof(
    fc.constantFrom('..', '.', '', 'a', 'b c', '%2e%2e', '%2F', 'x.xhtml', 'C:', '\\'),
    fc.string({ maxLength: 6 }),
  );
  const href = fc.array(part, { maxLength: 6 }).map((parts) => parts.join('/'));

  it('never resolve outside the zip, nor to a name that isn’t clean', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('OEBPS', 'text', 'a b'), { maxLength: 3 }),
        href,
        fc.constantFrom('', '#x', '?q=1'),
        (folders, ref, tail) => {
          const at = inZip([...folders, 'chapter.xhtml'].join('/'), `${ref}${tail}`);
          if (at === null) return;
          expect(isZipPath(at.path)).toBe(true);
          expect(at.path.split('/')).not.toContain('..');
        },
      ),
    );
  });
});

describe('fromUtf8', () => {
  it('reads any bytes as the system’s decoder does', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), (bytes) => {
        expect(fromUtf8(bytes)).toBe(new TextDecoder().decode(bytes));
      }),
      { numRuns: 1000 },
    );
  });

  it('reads any text back as it was written', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 40 }), (text) => {
        expect(fromUtf8(new TextEncoder().encode(text))).toBe(text.replace(/^\ufeff/u, ''));
      }),
    );
  });
});
