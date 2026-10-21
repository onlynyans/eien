// Phase 11 on the real app (spec §8): File → Export Note and Export Book,
// and a note's and a book's own Export…, save EPUB, Word and PDF where the
// system's dialog says; the files are read back here (the zips by a strict
// reader, the PDF by its pages). A book goes in its own order, the open
// chapter as it is on the page.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { shownText } from '../support/export-parts';
import { readZip } from '../support/read-zip';
import { assertWellFormedXml } from '../support/xml-check';
import { clickMenu, editorContent, expect, test } from './launch';

const FOLDER = JSON.stringify({ order: ['Mending.md', 'Fire.md'], book: {} });

test.use({
  vaultFiles: {
    'Scarf/.eien-folder.json': FOLDER,
    'Scarf/Fire.md': '# The Fire\n\nIt ==burned==.[^1]\n\n[^1]: All of it.',
    'Scarf/Mending.md': '---\nid: N1\n---\n"Look," he said.\n\n***\n\nShe *mended* it.',
    'Scarf/Notes.sync-conflict-20261019-164012-ABCDEFG.md': 'Not a chapter.',
    'Loose.md': 'A note in no book.',
    'Blank.md': '',
  },
});

const notice = (page: Page) => page.locator('.list__notice');

async function open(page: Page, title: string): Promise<void> {
  await page.locator('.note-row', { hasText: title }).first().click();
  await expect(page.locator('.title')).toHaveText(title);
}

/** The save dialog, answered with `file`; what it offered is kept, in globalThis.offered. */
async function saveTo(app: ElectronApplication, file: string | null): Promise<void> {
  await app.evaluate(({ dialog }, file) => {
    const offered: { title?: string; defaultPath?: string; extensions?: string[] }[] = [];
    (globalThis as { offered?: typeof offered }).offered = offered;
    dialog.showSaveDialog = (async (
      _window: unknown,
      options: { title?: string; defaultPath?: string; filters?: { extensions: string[] }[] },
    ) => {
      offered.push({
        title: options.title,
        defaultPath: options.defaultPath,
        extensions: options.filters?.[0]?.extensions,
      });
      return file ? { canceled: false, filePath: file } : { canceled: true };
    }) as typeof dialog.showSaveDialog;
  }, file);
}

const offered = (app: ElectronApplication) =>
  app.evaluate(
    () =>
      (
        globalThis as {
          offered?: { title?: string; defaultPath?: string; extensions?: string[] }[];
        }
      ).offered ?? [],
  );

/** The pages a PDF has (its page objects, which Chromium writes uncompressed). */
const pagesOf = (pdf: Buffer) =>
  pdf.toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/gu)?.length ?? 0;

test.describe('exports', () => {
  let out: string;
  test.beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), 'eien-out-'));
  });
  test.afterEach(() => {
    rmSync(out, { recursive: true, force: true });
  });

  test('the File menu: Export Note and Export Book, each EPUB, Word and PDF; Import', async ({
    app,
    page,
  }) => {
    await expect(page.locator('.note-row').first()).toBeVisible();
    const file = await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()
        ?.items.find((menu) => menu.label === 'File')
        ?.submenu?.items.map((item) => [
          item.label,
          item.submenu?.items.map((sub) => sub.label) ?? null,
        ]),
    );
    expect(file).toEqual(
      expect.arrayContaining([
        ['Export AO3 HTML…', null],
        ['Export Note', ['EPUB…', 'Word (.docx)…', 'PDF…']],
        ['Export Book', ['EPUB…', 'Word (.docx)…', 'PDF…']],
        ['Import Markdown Folder…', null],
      ]),
    );
  });

  test('Export Book → EPUB: the book’s order, its title page, the open chapter as typed', async ({
    app,
    page,
  }) => {
    const file = join(out, 'Scarf.epub');
    await saveTo(app, file);
    await open(page, 'Mending');
    await editorContent(page).press('ControlOrMeta+End');
    await page.keyboard.type(' Twice.');
    await clickMenu(app, 'File', 'Export Book', 'EPUB…');
    await expect(notice(page)).toHaveText('Saved as “Scarf.epub”.');
    expect(await offered(app)).toEqual([
      {
        title: 'Export EPUB',
        defaultPath: expect.stringMatching(/[\\/]Scarf\.epub$/u),
        extensions: ['epub'],
      },
    ]);
    const epub = readZip(new Uint8Array(readFileSync(file)));
    expect(epub.names[0]).toBe('mimetype');
    for (const name of epub.names.filter((n) => /\.(?:xhtml|opf|ncx|xml)$/u.test(n))) {
      assertWellFormedXml(epub.text(name));
    }
    expect(shownText(epub.text('OEBPS/nav.xhtml'))).toBe('Contents Contents Mending The Fire');
    expect(shownText(epub.text('OEBPS/chapter-1.xhtml'))).toBe(
      'Mending Mending “Look,” he said. * * * She mended it. Twice.',
    );
    expect(epub.text('OEBPS/chapter-2.xhtml')).toContain('It <mark>burned</mark>.');
    expect(epub.text('OEBPS/chapter-2.xhtml')).toContain('<aside epub:type="footnote" id="fn1">');
    expect(epub.names).not.toContain('OEBPS/chapter-3.xhtml'); // the conflict copy isn't a chapter
  });

  test('a book’s own Export… → Word: its chapters under Heading 1, a footnote of Word’s own', async ({
    app,
    page,
  }) => {
    const file = join(out, 'Scarf.docx');
    await saveTo(app, file);
    await expect(page.locator('.note-row').first()).toBeVisible();
    await page.locator('.tree-row__label', { hasText: 'Scarf' }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Export…' }).click();
    await expect(page.getByRole('menuitem')).toHaveText(['EPUB…', 'Word (.docx)…', 'PDF…']);
    await page.getByRole('menuitem', { name: 'Word (.docx)…' }).click();
    await expect(notice(page)).toHaveText('Saved as “Scarf.docx”.');
    const word = readZip(new Uint8Array(readFileSync(file)));
    const document = word.text('word/document.xml');
    assertWellFormedXml(document);
    expect(shownText(document)).toBe(
      'Scarf Mending “Look,” he said. * * * She mended it. The Fire It burned.',
    );
    expect(document).toContain('<w:footnoteReference w:id="1"/>');
    expect(shownText(word.text('word/footnotes.xml'))).toBe('All of it.');
  });

  test('Export Note → PDF and Export Book → PDF: a page per chapter, after a title page', async ({
    app,
    page,
  }) => {
    await open(page, 'Loose');
    await saveTo(app, join(out, 'Loose.pdf'));
    await clickMenu(app, 'File', 'Export Note', 'PDF…');
    await expect(notice(page)).toHaveText('Saved as “Loose.pdf”.', { timeout: 30_000 });
    const note = readFileSync(join(out, 'Loose.pdf'));
    expect(note.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pagesOf(note)).toBe(1);

    await open(page, 'Fire');
    await saveTo(app, join(out, 'Scarf.pdf'));
    await clickMenu(app, 'File', 'Export Book', 'PDF…');
    await expect(notice(page)).toHaveText('Saved as “Scarf.pdf”.', { timeout: 30_000 });
    expect(pagesOf(readFileSync(join(out, 'Scarf.pdf')))).toBe(3); // the title page, then two chapters
  });

  test('a note’s own Export… → EPUB, for a note that isn’t open', async ({ app, page }) => {
    const file = join(out, 'Loose.epub');
    await saveTo(app, file);
    await page.locator('.note-row', { hasText: 'Loose' }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Export…' }).click();
    await expect(page.getByRole('menuitem')).toHaveText([
      'AO3 HTML…',
      'EPUB…',
      'Word (.docx)…',
      'PDF…',
    ]);
    await page.getByRole('menuitem', { name: 'EPUB…' }).click();
    await expect(notice(page)).toHaveText('Saved as “Loose.epub”.');
    const epub = readZip(new Uint8Array(readFileSync(file)));
    expect(epub.names).not.toContain('OEBPS/title.xhtml'); // a note has no title page
    expect(shownText(epub.text('OEBPS/chapter-1.xhtml'))).toBe('Loose Loose A note in no book.');
  });

  test('nothing to export says so, and a cancelled dialog saves nothing', async ({ app, page }) => {
    await saveTo(app, null);
    await open(page, 'Blank');
    await clickMenu(app, 'File', 'Export Note', 'EPUB…');
    await expect(notice(page)).toHaveText('Nothing to export: the note has no words yet.');
    expect(await offered(app)).toEqual([]);

    await open(page, 'Loose');
    await clickMenu(app, 'File', 'Export Book', 'Word (.docx)…');
    await expect(notice(page)).toHaveText(
      'Export Book exports a book: choose one, or open one of its chapters.',
    );

    await clickMenu(app, 'File', 'Export Note', 'Word (.docx)…');
    await expect.poll(async () => (await offered(app)).length).toBe(1);
    await expect(notice(page)).not.toHaveText(/Saved/u);
  });
});
