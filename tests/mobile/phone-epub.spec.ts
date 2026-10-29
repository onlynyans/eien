// A book on the phone (#40): SHELF in the sidebar, the book a page of the
// phone's stack, its contents the list behind its back bar.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import { seriousViolations } from '../e2e/axe';
import { bytesOutside, listOutside, open, putBytesOutside, putOutside, titles } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');
const back = (page: Page) => page.locator('.phone-bar__back');
const chapter = (page: Page) => page.locator('.epub-chapter');

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme });

    test('a book opens from the shelf, its contents behind its back bar, with no serious violation', async ({
      page,
    }) => {
      await open(page);
      await putOutside(page, 'Eien/Vault/Notes.md', 'Notes on the book.\n');
      await putBytesOutside(
        page,
        'Eien/Vault/Novels/Pride and Prejudice.epub',
        readFileSync(FIXTURE).toString('base64'),
      );
      await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
      await back(page).click(); // the list's back: the sidebar
      const book = page.locator('.tree-row--epub .tree-row__name', {
        hasText: 'Pride and Prejudice',
      });
      await expect(book).toBeVisible({ timeout: 10_000 });
      expect(await seriousViolations(page), 'the shelf').toEqual([]);
      await book.click();
      await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
      await expect(chapter(page)).toBeInViewport();
      expect(await seriousViolations(page), 'the book').toEqual([]);
      await back(page).click();
      const rows = page.locator('.contents-row');
      await expect(rows).toHaveText(['Chapter I', 'Chapter II', 'Chapter III']);
      expect(await seriousViolations(page), 'its contents').toEqual([]);
      await rows.nth(2).click();
      await expect(chapter(page)).toContainText('Not all that Mrs. Bennet');
      // The chapter chosen brings the page back into sight.
      await expect(chapter(page)).toBeInViewport();
      await expect(chapter(page).locator('img')).toHaveAttribute('src', /^blob:/u);
    });
  });
}

test('a book’s place is kept as the phone goes to the background, and back after a restart', async ({
  page,
}) => {
  await page.clock.install();
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await back(page).click(); // the list's back: the sidebar
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  // The chapters either side at its foot, at a finger's size.
  const next = page.getByRole('button', { name: 'Next chapter: Chapter II' });
  expect((await next.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  const scroller = page.locator('.page__leaf--epub .page__scroll');
  const inSight = () =>
    scroller.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const at = document.caretRangeFromPoint(box.left + box.width / 2, box.top + 4);
      return at?.startContainer.parentElement?.closest('p')?.textContent?.slice(0, 60) ?? '';
    });
  // The clock stops: the place is never kept at a rest, only on the way out.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
  await scroller.evaluate((element) => {
    element.scrollTop = 1500;
  });
  const kept = await inSight();
  expect(kept).not.toBe('');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => listOutside(page, 'Eien/Vault/.eien/reading')).toHaveLength(1);
  await page.clock.resume();
  await open(page);
  await back(page).click();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect.poll(inSight).toBe(kept);
});

test('a book’s row menu renames it in its row, and trashes it to .eien/trash, whole', async ({
  page,
}) => {
  await open(page);
  await putOutside(page, 'Eien/Vault/Notes.md', 'Notes on the book.\n');
  const bytes = readFileSync(FIXTURE).toString('base64');
  await putBytesOutside(page, 'Eien/Vault/Novels/Pride and Prejudice.epub', bytes);
  await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
  await back(page).click(); // the sidebar
  const book = (title: string) =>
    page.locator('.tree-row--epub .tree-row__name', { hasText: new RegExp(`^${title}$`, 'u') });
  await expect(book('Pride and Prejudice')).toBeVisible({ timeout: 10_000 });

  // Renamed in its row, as on the desktop: a book's page has no title to type in.
  await book('Pride and Prejudice').click({ button: 'right' });
  // A phone names it .eien/trash; this page in Chromium is Capacitor's 'web', which says the
  // trash. Either way the book lands in .eien/trash, below.
  const trashItem = /^Move to (\.eien\/trash|the trash)$/u;
  await expect(page.getByRole('menuitem')).toHaveText(['Rename', 'Move to…', trashItem]);
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const field = page.locator('.name-field__input');
  await expect(field).toHaveValue('Pride and Prejudice');
  await expect(page.locator('.name-field__suffix')).toHaveText('.epub');
  await field.fill('First Impressions');
  await field.press('Enter');
  await expect(book('First Impressions')).toBeVisible({ timeout: 10_000 });
  expect(await listOutside(page, 'Eien/Vault/Novels')).toEqual(['First Impressions.epub']);

  // The trash: the vault's own, where any device can take it back.
  await book('First Impressions').click({ button: 'right' });
  await page.getByRole('menuitem', { name: trashItem }).click();
  await expect(book('First Impressions')).toHaveCount(0, { timeout: 10_000 });
  const stamps = await listOutside(page, 'Eien/Vault/.eien/trash');
  expect(stamps).toHaveLength(1);
  expect(
    await bytesOutside(page, `Eien/Vault/.eien/trash/${stamps[0]}/First Impressions.epub`),
  ).toEqual([...readFileSync(FIXTURE)]);
});

test('the shelf’s look on the phone says at its foot that Settings sets notes', async ({
  page,
}) => {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await back(page).click();
  await page.locator('.tree-row--epub .tree-row__name').click({ timeout: 10_000 });
  await expect(chapter(page)).toContainText('It is a truth');
  await page
    .locator('.phone-bar__controls [data-command="look"], .page__phone [data-command="look"]')
    .first()
    .click();
  const sheet = page.getByRole('dialog', { name: 'Look: Shelf' });
  await expect(sheet.locator('.quick-look__foot .quick-look__line')).toHaveText(
    'Settings sets notes; this is every book’s look.',
  );
  expect(await seriousViolations(page), 'the shelf’s sheet').toEqual([]);
});
