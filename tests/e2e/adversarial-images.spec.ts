// Adversarial: images in a book's exports on the real app (spec §8: "Images
// from the vault go in"; one left out is counted in the news; 48 MB of images
// in all, each file once). Both tests fail on the code as it stands.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { png } from '../support/images';
import { readZip } from '../support/read-zip';
import { clickMenu, expect, test } from './launch';

const notice = (page: Page) => page.locator('.list__notice');

async function saveTo(app: ElectronApplication, file: string): Promise<void> {
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = (async () => ({
      canceled: false,
      filePath: file,
    })) as typeof dialog.showSaveDialog;
  }, file);
}

let out: string;
test.beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), 'eien-adv-out-'));
});
test.afterEach(() => {
  rmSync(out, { recursive: true, force: true });
});

test.describe('an image in a footnote', () => {
  test.use({
    vaultFiles: {
      'Scarf/.eien-folder.json': JSON.stringify({ order: ['One.md'], book: {} }),
      // The footnote's second paragraph is the picture: the export reads the whole
      // note as one, where that indented line is code, so it never reads dot.png.
      'Scarf/One.md': 'A dot.[^1]\n\n[^1]: Look closely:\n\n    ![A dot](dot.png)\n',
      'Scarf/dot.png': png(40, 40),
    },
  });

  test('goes into the book’s EPUB', async ({ app, page }) => {
    await page.locator('.note-row', { hasText: 'One' }).first().click();
    await saveTo(app, join(out, 'Scarf.epub'));
    await clickMenu(app, 'File', 'Export Book', 'EPUB…');
    await expect(notice(page)).toHaveText(/^Saved as “Scarf\.epub”\./u);
    const epub = readZip(new Uint8Array(readFileSync(join(out, 'Scarf.epub'))));
    // Today: no image in the book, its description in the footnote, and the news silent.
    expect({
      news: await notice(page).textContent(),
      images: epub.names.filter((name) => name.startsWith('OEBPS/images/')),
    }).toEqual({ news: 'Saved as “Scarf.epub”.', images: ['OEBPS/images/image-1.png'] });
  });
});

test.describe('a PDF whose one ornament opens every chapter', () => {
  const chapters = Array.from(
    { length: 28 },
    (_, i) => `Chapter ${String(i + 1).padStart(2, '0')}.md`,
  );
  test.use({
    vaultFiles: {
      'Book/.eien-folder.json': JSON.stringify({ order: chapters, book: {} }),
      'Book/ornament.png': png(1000, 1000), // 3 MB: within the 48 MB an export carries
      ...Object.fromEntries(
        chapters.map((name, i) => [`Book/${name}`, `![](ornament.png)\n\nChapter ${i + 1}.\n`]),
      ),
    },
  });

  test('is saved', async ({ app, page }) => {
    test.setTimeout(120_000);
    await page.locator('.note-row', { hasText: 'Chapter 01' }).first().click();
    await saveTo(app, join(out, 'Book.pdf'));
    await clickMenu(app, 'File', 'Export Book', 'PDF…');
    await expect(notice(page)).toHaveText(/^(?:Saved as|It couldn’t)/u, { timeout: 90_000 });
    // Today: "It couldn’t be exported: html is too long." The page repeats the
    // ornament's 4 MB of base64 in each of the 28 chapters: past the 96 Mi characters taken.
    expect(await notice(page).textContent()).toBe('Saved as “Book.pdf”.');
  });
});
