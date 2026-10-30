// A book's page numbers (#40, Phase 4): the printed edition's where the
// book has a page-list, at once; else steady pages of 1,500 characters, once
// the book is counted, the same across a restart and a new width.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { longBook } from '../support/long-book';
import { closeApp, expect, launchApp, ROOT, test } from './launch';

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

  test('are steady ones otherwise, the same across a restart and a new width', async ({
    page,
    app,
    vault,
    userData,
  }) => {
    if (!vault) throw new Error('no vault');
    await shelfEpub(page, 'Long').click();
    await page.locator('.contents-row').nth(30).click();
    await expect(page.locator('.epub-chapter h1')).toHaveText('Chapter 31');
    // Thirty chapters of 200 paragraphs before it: page 529 or so of 1,056.
    await expect(pageFigure(page)).toHaveText(/^page \d{3} of 1,0\d\d$/u, { timeout: 30_000 });
    const said = await pageFigure(page).textContent();
    await page.setViewportSize({ width: 1100, height: 700 });
    await expect(pageFigure(page)).toHaveText(said ?? '');
    await closeApp(app);
    const again = await launchApp(userData, vault);
    const next = await again.firstWindow();
    await next.setViewportSize({ width: 1600, height: 900 });
    await shelfEpub(next, 'Long').click();
    await expect(next.locator('.epub-chapter h1')).toHaveText('Chapter 31');
    await expect(pageFigure(next)).toHaveText(said ?? '', { timeout: 30_000 });
    await closeApp(again);
  });
});
