// The fixture books (#40) on disk are what their script makes now: change
// tests/support/epub-fixtures.ts, run `node scripts/epub-fixtures.mjs`, commit both.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chaptersOf, fixtureEpubs } from './support/epub-fixtures';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'tests/fixtures/epub');

describe('the fixture books', () => {
  it('are the same bytes their script makes', () => {
    // As the script runs: a zip's dates are local time. Put back after, so no later test runs in UTC.
    const zone = process.env.TZ;
    process.env.TZ = 'UTC';
    let books: Record<string, Uint8Array>;
    try {
      books = fixtureEpubs({
        chapters: chaptersOf(
          readFileSync(join(ROOT, 'docs/design/explorations/_src/epub-text.js'), 'utf8'),
        ),
        plate: readFileSync(join(OUT, 'source/black-horse.jpg')),
        headpiece: readFileSync(join(OUT, 'source/headpiece.jpg')),
      });
    } finally {
      if (zone === undefined) Reflect.deleteProperty(process.env, 'TZ');
      else process.env.TZ = zone;
    }
    const onDisk = readdirSync(OUT).filter((name) => name.endsWith('.epub'));
    expect(onDisk.sort()).toEqual(Object.keys(books).sort());
    for (const [name, bytes] of Object.entries(books)) {
      expect(Buffer.compare(readFileSync(join(OUT, name)), bytes), name).toBe(0);
    }
  });

  it('hold Pride and Prejudice’s first three chapters', () => {
    const chapters = chaptersOf(
      readFileSync(join(ROOT, 'docs/design/explorations/_src/epub-text.js'), 'utf8'),
    );
    expect(chapters).toHaveLength(3);
    expect(chapters[0]?.[0]).toMatch(/^It is a truth universally acknowledged/u);
  });
});
