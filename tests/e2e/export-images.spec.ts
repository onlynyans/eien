// Images in exports and imports on the real app (spec §8): a book's vault
// images go into its EPUB, Word file and PDF, read back from the files
// saved; one that isn't there goes as its description, and the news says
// so; an import brings a folder's images beside its notes.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { png } from '../support/images';
import { readZip } from '../support/read-zip';
import { assertSoundXhtml } from '../support/xml-check';
import { clickMenu, expect, test } from './launch';

const SCARF = png(400, 300);

test.use({
  vaultFiles: {
    'Scarf/.eien-folder.json': JSON.stringify({ order: ['One.md', 'Two.md'], book: {} }),
    'Scarf/One.md': 'Before ![A red scarf](../art/scarf.png) after.\n\n![gone](missing.png)',
    'Scarf/Two.md': 'Again: ![the scarf](/art/scarf.png) ![web](https://example.org/x.png)',
    'art/scarf.png': SCARF,
  },
});

const notice = (page: Page) => page.locator('.list__notice');

async function saveTo(app: ElectronApplication, file: string): Promise<void> {
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = (async () => ({
      canceled: false,
      filePath: file,
    })) as typeof dialog.showSaveDialog;
  }, file);
}

const LEFT = '1 image went as its description (not there, too big, or not PNG, JPEG or GIF).';

test.describe('images', () => {
  let out: string;
  test.beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), 'eien-out-'));
  });
  test.afterEach(() => {
    rmSync(out, { recursive: true, force: true });
  });

  test('a book’s EPUB, Word file and PDF carry its vault images, once each', async ({
    app,
    page,
  }) => {
    await page.locator('.note-row', { hasText: 'One' }).first().click();

    await saveTo(app, join(out, 'Scarf.epub'));
    await clickMenu(app, 'File', 'Export Book', 'EPUB…');
    await expect(notice(page)).toHaveText(`Saved as “Scarf.epub”. ${LEFT}`);
    const epub = readZip(new Uint8Array(readFileSync(join(out, 'Scarf.epub'))));
    expect(epub.names.filter((name) => name.includes('/images/'))).toEqual([
      'OEBPS/images/image-1.png',
    ]);
    expect(
      Buffer.compare(epub.files.get('OEBPS/images/image-1.png') ?? new Uint8Array(), SCARF),
    ).toBe(0);
    const one = epub.text('OEBPS/chapter-1.xhtml');
    assertSoundXhtml(one);
    expect(one).toContain('<img src="images/image-1.png" alt="A red scarf" />');
    expect(one).toContain('<p>gone</p>');
    expect(epub.text('OEBPS/chapter-2.xhtml')).toContain(
      '<img src="images/image-1.png" alt="the scarf" />',
    );

    await saveTo(app, join(out, 'Scarf.docx'));
    await clickMenu(app, 'File', 'Export Book', 'Word (.docx)…');
    await expect(notice(page)).toHaveText(`Saved as “Scarf.docx”. ${LEFT}`);
    const word = readZip(new Uint8Array(readFileSync(join(out, 'Scarf.docx'))));
    expect(word.names).toContain('word/media/image-1.png');
    // 400 × 300 px at 96 an inch: 4⅙ in × 3⅛ in, inside the text's width.
    expect(
      word.text('word/document.xml').match(/<wp:extent cx="3810000" cy="2857500"\/>/gu),
    ).toHaveLength(2);

    await saveTo(app, join(out, 'Scarf.pdf'));
    await clickMenu(app, 'File', 'Export Book', 'PDF…');
    await expect(notice(page)).toHaveText(`Saved as “Scarf.pdf”. ${LEFT}`, { timeout: 30_000 });
    const pdf = readFileSync(join(out, 'Scarf.pdf')).toString('latin1');
    expect(pdf.match(/\/Subtype\s*\/Image/gu)?.length ?? 0).toBeGreaterThan(0);
  });

  test('an import brings a folder’s images beside its notes', async ({ app, page, vault }) => {
    const source = join(out, 'Drafts');
    mkdirSync(join(source, 'pics'), { recursive: true });
    writeFileSync(join(source, 'Chapter.md'), 'Words first.\n\n![me](pics/me.png)');
    writeFileSync(join(source, 'pics', 'me.png'), SCARF);
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [folder],
      })) as typeof dialog.showOpenDialog;
    }, source);
    await expect(page.locator('.note-row').first()).toBeVisible();
    await clickMenu(app, 'File', 'Import Markdown Folder…');
    await expect(notice(page)).toHaveText('Imported 1 note and 1 image into “Drafts”.');
    expect(Buffer.compare(readFileSync(join(vault ?? '', 'Drafts/pics/me.png')), SCARF)).toBe(0);
    // The note shows it, from where it came in.
    await page.locator('.note-row', { hasText: 'Chapter' }).click();
    const picture = page.locator('img.eien-image');
    await expect(picture).toHaveAttribute('src', /^blob:/u);
    await expect
      .poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(400);
  });
});
