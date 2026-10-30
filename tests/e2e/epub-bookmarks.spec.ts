// A book's bookmarks (#40, Phase 4b): B or the tool bookmarks the page in
// sight, which wears the Page mark (ribbon, dog-ear or edge tab), kept in
// .eien/reading across a restart; in Pages, only the bookmarked page wears
// it; in a split in Facing pages, the mark keeps saying "the page you're in"
// and the book's folio says "bookmarked" instead.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { chooseSetting, clickMenu, closeApp, expect, launchApp, ROOT, test } from './launch';

const epub = (name: string) =>
  new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/epub', name)));

const shelfEpub = (page: Page) =>
  page.locator('.tree-row--epub .tree-row__name').filter({ hasText: 'Pride and Prejudice' });
const leaf = (page: Page) => page.locator('.page__leaf--epub');
const mark = (page: Page) => leaf(page).locator('.page__mark--bookmark');
const tool = (page: Page) => page.locator('[data-command="bookmark"]:visible').first();

/** The bookmarks in the reading state's one file in `vault`. */
function bookmarksIn(vault: string): { chapter: string; offset: number; words: string }[] {
  const folder = join(vault, '.eien/reading');
  if (!existsSync(folder)) return [];
  const [file] = readdirSync(folder).filter((name) => name.endsWith('.json'));
  return file ? (JSON.parse(readFileSync(join(folder, file), 'utf8')).bookmarks ?? []) : [];
}

async function openBook(page: Page): Promise<void> {
  await shelfEpub(page).click();
  await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
  await leaf(page).locator('.page__scroll').focus();
}

test.describe('a book’s bookmarks', () => {
  test.use({
    vaultFiles: {
      'Novels/Pride and Prejudice.epub': epub('plain.epub'),
      'Notes.md': 'Snow on the walls.\n',
    },
  });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('B bookmarks the page, its mark and tool say so, and it’s there after a restart', async ({
    page,
    app,
    vault,
    userData,
  }) => {
    if (!vault) throw new Error('no vault');
    await openBook(page);
    await expect(mark(page)).toBeHidden();
    await expect(tool(page)).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    await expect(tool(page)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => bookmarksIn(vault).length).toBe(1);
    expect(bookmarksIn(vault)[0]?.words).toMatch(/It is a truth/u);
    await closeApp(app);
    const again = await launchApp(userData, vault);
    const next = await again.firstWindow();
    await next.setViewportSize({ width: 1600, height: 900 });
    await openBook(next);
    await expect(mark(next)).toBeVisible();
    // The tool takes it off.
    await tool(next).click();
    await expect(mark(next)).toBeHidden();
    await expect.poll(() => bookmarksIn(vault).length).toBe(0);
    await closeApp(again);
  });

  test('wears each of the three Page marks', async ({ page }) => {
    await openBook(page);
    await page.keyboard.press('b');
    for (const kind of ['ribbon', 'dogear', 'tab'] as const) {
      await chooseSetting(page, 'appearance.facingMark', kind);
      await expect(page.locator('html')).toHaveAttribute('data-facing-mark', kind);
      await expect(mark(page)).toBeVisible();
      const box = await mark(page).boundingBox();
      const sheet = await leaf(page).locator('.epub-sheet').boundingBox();
      if (!box || !sheet) throw new Error('nothing in sight');
      // At the sheet's outer edge, its top.
      expect(box.x + box.width / 2).toBeGreaterThan(sheet.x + sheet.width / 2);
      expect(box.y).toBeLessThan(sheet.y + sheet.height / 4);
    }
  });

  test('in pages, only the bookmarked page wears it', async ({ page, app }) => {
    await openBook(page);
    await page.locator('[data-command="view.pages"]:visible').first().click();
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(mark(page)).toBeHidden();
    await page.keyboard.press('ArrowLeft');
    await expect(mark(page)).toBeVisible();
    // The menu bar's View → Bookmark This Page takes it off.
    await clickMenu(app, 'View', 'Bookmark This Page');
    await expect(mark(page)).toBeHidden();
  });
});

test.describe('Marks in the list (Phase 4c)', () => {
  test.use({
    vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') },
  });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('lists the bookmarks under Marks, a row going to its page, Delete taking it off', async ({
    page,
  }) => {
    await openBook(page);
    // A bookmark in the third chapter, then back at the first.
    await page.locator('.contents-row').nth(2).click();
    await expect(leaf(page).locator('.epub-chapter')).toContainText('Not all that Mrs. Bennet');
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    await page.getByRole('tab', { name: /Marks/u }).click();
    await expect(page.getByRole('tab', { name: /Marks/u })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const row = page.locator('.mark-row');
    await expect(row).toHaveCount(1);
    await expect(row.locator('.mark-row__words')).toContainText('Not all that Mrs. Bennet');
    await expect(row.locator('.mark-row__chapter')).toHaveText('Chapter III');
    await expect(row.locator('.mark-row__page')).toHaveText(/^\d+$/u);
    await page.getByRole('tab', { name: /Contents/u }).click();
    await page.locator('.contents-row').nth(0).click();
    await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
    await page.getByRole('tab', { name: /Marks/u }).click();
    await row.click();
    await expect(leaf(page).locator('.epub-chapter')).toContainText('Not all that Mrs. Bennet');
    await expect(mark(page)).toBeVisible();
    await row.focus();
    await page.keyboard.press('Delete');
    await expect(row).toHaveCount(0);
    await expect(page.locator('.list__empty')).toHaveText('Nothing kept yet. B bookmarks a page.');
    await expect(mark(page)).toBeHidden();
  });

  test('lists them under the book’s row with two panes', async ({ page }) => {
    await page.locator('[data-command="panes"]').click();
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
    await openBook(page);
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    await page.locator('.tree-row--lenses').getByRole('tab', { name: /Marks/u }).click();
    const row = page.locator('.tree-row--mark .tree-row__name');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('It is a truth');
  });
});

test.describe('a bookmark in Facing pages', () => {
  test.use({
    vaultFiles: {
      'Novels/Pride and Prejudice.epub': epub('plain.epub'),
      'Notes.md': 'Snow on the walls.\n',
    },
    deviceFile: { settings: { 'appearance.split': 'facing' } },
  });

  test('wears no mark there, its folio saying “bookmarked”, its tool pressed', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.locator('.note-row', { hasText: 'Notes' }).click();
    await shelfEpub(page).click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
    await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('b');
    const folio = leaf(page).locator('.page__folio');
    await expect(folio.locator('.colophon__bookmarked')).toHaveText('bookmarked');
    await expect(folio.locator('.colophon__bookmarked')).toBeVisible();
    // The facing mark keeps its meaning: one mark, the active page's; the bookmark's not drawn.
    await expect(mark(page)).toBeHidden();
    await expect(page.locator('.page__mark--active')).toHaveCount(1);
    await expect(folio.locator('[data-command="bookmark"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Closed to one page by a narrower window, still no bookmark mark.
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(page.locator('.page__pages[data-narrow="close"]')).toHaveCount(1);
    await expect(mark(page)).toBeHidden();
  });
});
