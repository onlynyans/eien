// A book's page numbers (#40, Phase 4; #67): the printed edition's where
// the book has a page-list, at once; else, in Pages, the chapter's own pages
// as laid out, a page a turn and the folios the same number, one page or a
// spread's two; scrolling, how far through the chapter.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { longBook } from '../support/long-book';
import { expect, ROOT, test } from './launch';

const epub = (name: string) =>
  new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/epub', name)));

const shelfEpub = (page: Page, title: string) =>
  page.locator('.tree-row--epub .tree-row__name').filter({ hasText: title });
const pageFigure = (page: Page) => page.locator('.colophon .colophon__page');

test.describe('a book’s page numbers', () => {
  test.use({
    vaultFiles: {
      'Novels/Printed.epub': epub('page-list.epub'),
      'Novels/Long.epub': longBook({ chapters: 60, paragraphs: 200 }),
    },
  });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('are the printed edition’s where the book has them, in Scroll and in Pages', async ({
    page,
  }) => {
    await shelfEpub(page, 'Printed').click();
    // The front matter's page, named by its chapter alone; the book's pages by its last.
    await expect(pageFigure(page)).toHaveText('page xii of 5');
    await page.locator('.contents-row').nth(1).click();
    await expect(pageFigure(page)).toHaveText('page 2 of 5');
    await page.locator('[data-command="view.pages"]:not(.page__phone *)').first().click();
    await expect(pageFigure(page)).toHaveText('page 2 of 5');
  });

  test('say how far through the chapter otherwise, scrolling, and through the book', async ({
    page,
  }) => {
    await shelfEpub(page, 'Long').click();
    await page.locator('.contents-row').nth(30).click();
    await expect(page.locator('.epub-chapter h1')).toHaveText('Chapter 31');
    await expect(pageFigure(page)).toHaveText('0% of the chapter');
    // The book's figure, worded, and no other figure of the chapter's.
    await expect(page.locator('.colophon .colophon__through')).toHaveCount(1);
    await expect(page.locator('.colophon .colophon__through')).toHaveText(/^\d+% of the book$/u);
    await page.locator('.page__leaf--epub .page__scroll').focus();
    await page.keyboard.press('End');
    await expect(pageFigure(page)).toHaveText('100% of the chapter');
  });
});

// QA (#40, Phase 4a): where the figure stands with a note beside (Facing
// pages puts each page's figures in its own folio), and Pages with motion
// reduced, where every turn is instant and the count is never held back.
test.describe('a book’s page number beside a note, in Facing pages', () => {
  test.use({
    vaultFiles: {
      'Novels/Printed.epub': epub('page-list.epub'),
      'Notes.md': 'Snow on the walls.\n',
    },
    deviceFile: { settings: { 'appearance.split': 'facing' } },
  });

  test('is in the book’s own folio, never the note’s', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.locator('.note-row', { hasText: 'Notes' }).click();
    await shelfEpub(page, 'Printed').click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
    await expect(page.locator('.page__leaf--epub .page__folio .colophon__page')).toHaveText(
      'page xii of 5',
    );
    await expect(
      page.locator('.page__leaf:not(.page__leaf--epub) .page__folio .colophon__page'),
    ).toHaveCount(0);
  });
});

/** The folios' words on the book's own sheet, the verso's then the recto's (one page: its number second). */
const folios = (page: Page) =>
  page
    .locator('.page__leaf--epub .epub-sheet:not([aria-hidden]) .epub-folios__item')
    .allTextContents();

test.describe('a book’s own pages in Pages, motion reduced (#67)', () => {
  test.use({
    vaultFiles: { 'Novels/Long.epub': longBook({ chapters: 3, paragraphs: 200 }) },
    deviceFile: { settings: { 'epub.view': 'pages', 'epub.landscape': 'one' } },
  });

  test('are the chapter’s, one a turn, the folio the same, and start again in the next', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1600, height: 900 });
    await shelfEpub(page, 'Long').click();
    await expect(pageFigure(page)).toHaveText(/^page 1 of \d+$/u);
    const pages = Number((await pageFigure(page).textContent())?.match(/of (\d+)/u)?.[1]);
    expect(pages).toBeGreaterThan(8);
    expect(await folios(page)).toEqual(['', '1']);
    await page.locator('.page__leaf--epub .page__scroll').focus();
    for (let at = 2; at <= 8; at++) {
      await page.keyboard.press('ArrowRight');
      await expect(pageFigure(page)).toHaveText(`page ${at} of ${pages}`);
      expect(await folios(page)).toEqual(['', String(at)]);
    }
    await page.keyboard.press('End');
    await expect(pageFigure(page)).toHaveText(`page ${pages} of ${pages}`);
    // On into the next chapter: its own first page.
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter h1')).toHaveText(
      'Chapter 2',
    );
    await expect(pageFigure(page)).toHaveText(/^page 1 of \d+$/u);
  });
});

test.describe('a spread’s own pages in Pages, motion reduced (#67)', () => {
  test.use({
    vaultFiles: { 'Novels/Long.epub': longBook({ chapters: 3, paragraphs: 200 }) },
    deviceFile: { settings: { 'epub.view': 'pages', 'epub.landscape': 'two' } },
  });

  test('say both of its pages, two a turn, each folio its own', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1600, height: 900 });
    await shelfEpub(page, 'Long').click();
    await expect(page.locator('.page__leaf--epub .epub__pages')).toHaveAttribute('data-spread', '');
    await expect(pageFigure(page)).toHaveText(/^pages 1–2 of \d+$/u);
    const pages = Number((await pageFigure(page).textContent())?.match(/of (\d+)/u)?.[1]);
    expect(await folios(page)).toEqual(['1', '2']);
    await page.locator('.page__leaf--epub .page__scroll').focus();
    for (let at = 3; at <= 7; at += 2) {
      await page.keyboard.press('ArrowRight');
      await expect(pageFigure(page)).toHaveText(`pages ${at}–${at + 1} of ${pages}`);
      expect(await folios(page)).toEqual([String(at), String(at + 1)]);
    }
    // The last spread: both its pages, or its last page alone where the chapter's pages are odd.
    await page.keyboard.press('End');
    await expect(pageFigure(page)).toHaveText(
      pages % 2 === 0 ? `pages ${pages - 1}–${pages} of ${pages}` : `page ${pages} of ${pages}`,
    );
  });
});
