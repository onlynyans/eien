// A book on the phone (#40): SHELF in the sidebar, the book a page of the
// phone's stack, its contents the list behind its back bar.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import { seriousViolations } from '../e2e/axe';
import { listOutside, open, putBytesOutside, putOutside, titles } from './outside';

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

test('a note’s reference shows the note over the page, a tap away from the words, with no serious violation', async ({
  page,
}) => {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Links.epub',
    readFileSync(join(import.meta.dirname, '../fixtures/epub/links.epub')).toString('base64'),
  );
  await back(page).click();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Links' }).click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  await chapter(page).locator('sup a[href]').tap();
  const note = page.getByRole('dialog', { name: 'Note 1' });
  await expect(note).toContainText('The novel’s first sentence, and its most quoted.');
  await expect(note).toBeInViewport();
  expect(await seriousViolations(page), 'a note over the page').toEqual([]);
  await note.getByRole('button', { name: 'Go to the note' }).tap();
  await expect(chapter(page)).toContainText('The novel’s first sentence, and its most quoted.');
  await expect(page.getByRole('button', { name: 'Back to Chapter I' })).toBeVisible();
});
