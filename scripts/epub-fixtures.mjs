// The fixture books (#40) written to tests/fixtures/epub/, from
// tests/support/epub-fixtures.ts, which uses Eien's own EPUB writer: run after
// changing it, and commit what it writes. The same bytes each time, which
// tests/epub-fixtures.test.ts holds them to. Run as `node scripts/epub-fixtures.mjs`.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runnerImport } from 'vite';

process.env.TZ = 'UTC'; // the zip's dates are written in local time
const root = join(import.meta.dirname, '..');
const out = join(root, 'tests/fixtures/epub');
const { module } = await runnerImport(join(root, 'tests/support/epub-fixtures.ts'));
const books = module.fixtureEpubs({
  chapters: module.chaptersOf(
    readFileSync(join(root, 'docs/design/explorations/_src/epub-text.js'), 'utf8'),
  ),
  plate: readFileSync(join(out, 'source/black-horse.jpg')),
  headpiece: readFileSync(join(out, 'source/headpiece.jpg')),
});
for (const [name, bytes] of Object.entries(books)) {
  writeFileSync(join(out, name), bytes);
  console.log(`${name}: ${bytes.length} bytes`);
}
