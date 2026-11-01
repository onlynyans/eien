// Find in a book (#40, Phase 5c): Edit → Find opens the page's own find bar
// over the book (the owner's answer, 2026-10-31), searching the whole book,
// on across chapters, the match it's on chosen as the bar closes; and the
// list's own field searching the book its contents show, every match a row
// under Found, a row going there, Enter on to the next.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { clickMenu, expect, ROOT, test } from './launch';

const epub = (name: string) =>
  new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/epub', name)));

const leaf = (page: Page) => page.locator('.page__leaf--epub');

async function openBook(page: Page): Promise<void> {
  await page
    .locator('.tree-row--epub .tree-row__name')
    .filter({ hasText: 'Pride and Prejudice' })
    .click();
  await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
  await leaf(page).locator('.page__scroll').focus();
}

for (const view of ['scroll', 'pages'] as const) {
  test.describe(`Find in a book, ${view}`, () => {
    test.use({
      vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') },
      deviceFile: { settings: { 'epub.view': view } },
    });
    test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

    test('Edit → Find searches the whole book, on across chapters, the match chosen as it closes', async ({
      page,
      app,
    }) => {
      await openBook(page);
      await clickMenu(app, 'Edit', 'Find', 'Find…');
      const bar = page.getByRole('search', { name: 'Find in the book' });
      await expect(bar).toBeVisible();
      const field = bar.getByRole('textbox', { name: 'Find' });
      await expect(field).toBeFocused();
      await field.fill('Bennet');
      const count = bar.locator('.find__count');
      await expect(count).toHaveText(/^1 of \d+$/u);
      const total = Number((await count.textContent())?.split(' of ')[1]);
      const chapters = new Set<string | null>();
      for (let i = 2; i <= total; i++) {
        await field.press('Enter');
        await expect(count).toHaveText(`${i} of ${total}`);
        chapters.add(await page.locator('.colophon__chapter').textContent());
      }
      expect(chapters.size).toBeGreaterThan(1);
      // The menu's Find Next goes round to the first.
      await clickMenu(app, 'Edit', 'Find', 'Find Next');
      await expect(count).toHaveText(`1 of ${total}`);
      expect(await page.evaluate(() => CSS.highlights.get('epub-found-current')?.size ?? 0)).toBe(
        1,
      );
      await field.press('Escape');
      await expect(bar).toBeHidden();
      expect(await page.evaluate(() => document.getSelection()?.toString())).toBe('Bennet');
    });
  });
}

test.describe('Found in the list', () => {
  test.use({ vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') } });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('the list’s field searches the book: every match a row, a row going there, Enter on', async ({
    page,
  }) => {
    await openBook(page);
    const search = page.getByRole('searchbox', { name: 'Search Pride and Prejudice' });
    await search.fill('Netherfield');
    const found = page.getByRole('button', { name: /^Found \d+$/u });
    await expect(found).toHaveAttribute('aria-pressed', 'true');
    const rows = page.locator('.found-row');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first().locator('.found-row__match')).toHaveText(/netherfield/iu);
    await rows.last().click();
    await expect
      .poll(() => page.evaluate(() => document.getSelection()?.toString()))
      .toMatch(/netherfield/iu);
    await search.focus();
    await search.press('Enter');
    await expect(page.locator('.colophon__said')).toHaveText(/^Match \d+ of \d+\.$/u);
    // Cleared: the list is the book's contents again.
    await search.fill('');
    await expect(page.locator('.contents-row').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Found' })).toBeDisabled();
  });

  test('says when the book holds none of the words', async ({ page }) => {
    await openBook(page);
    await page
      .getByRole('searchbox', { name: 'Search Pride and Prejudice' })
      .fill('zebra crossing');
    await expect(page.locator('.list__empty')).toHaveText(
      'No “zebra crossing” in Pride and Prejudice.',
    );
  });
});
