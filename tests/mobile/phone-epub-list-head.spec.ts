// A book's head in the list (#61): its title across the whole line, its
// author under it, and the lenses a row of their own under that, never
// crowding the author; Found only while a search is on.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Locator, type Page, test } from '@playwright/test';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');

/** The book open, then its contents in the list (behind the page's back bar, or beside it in Panes): the list's head. */
async function bookInList(page: Page, room?: 'panes'): Promise<Locator> {
  await open(page);
  if (room) await page.evaluate((room) => window.eien.settings.set('appearance.room', room), room);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await page.reload();
  const back = page.locator('.phone-bar__back');
  const row = page.locator('.tree-row--epub .tree-row__name');
  await expect
    .poll(async () => (await row.isVisible()) || (await back.isVisible()), { timeout: 10_000 })
    .toBe(true);
  if (!(await row.isVisible())) await back.click();
  await row.click();
  await expect(page.locator('.epub-chapter')).toContainText('It is a truth');
  if (await back.isVisible()) await back.click();
  const head = page.locator('.list__head:has(.book-lenses)');
  await expect(head).toBeVisible();
  return head;
}

/** The title runs to the head's own edge, the author under it, the lenses under that. */
async function laidAsABook(head: Locator): Promise<void> {
  const boxes = await head.evaluate((element) => {
    const box = (selector: string) => {
      const found = element.querySelector(selector)?.getBoundingClientRect();
      return found
        ? { left: found.left, right: found.right, top: found.top, bottom: found.bottom }
        : null;
    };
    const own = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      inner: own.right - Number.parseFloat(style.paddingRight),
      title: box('.list__heading'),
      author: box('.list__count'),
      lenses: box('.book-lenses'),
    };
  });
  expect(boxes.title?.right).toBeCloseTo(boxes.inner, 0);
  expect(boxes.author?.top).toBeGreaterThanOrEqual(boxes.title?.bottom ?? Number.POSITIVE_INFINITY);
  expect(boxes.lenses?.top).toBeGreaterThanOrEqual(
    boxes.author?.bottom ?? Number.POSITIVE_INFINITY,
  );
}

test('a book’s head: the title across the line, the author under it, the lenses under that', async ({
  page,
}) => {
  const head = await bookInList(page);
  await laidAsABook(head);
  await expect(head.getByRole('button')).toHaveText([/^Contents \d+$/u, /^Marks \d+$/u]);
});

test('a search joins Found to the lenses’ row, the title still across the line; cleared, Found goes', async ({
  page,
}) => {
  // A Galaxy Z Fold 5 opened upright, in Panes: the list beside the page, its search field on its band.
  await page.setViewportSize({ width: 690, height: 829 });
  const head = await bookInList(page, 'panes');
  const search = page.getByRole('searchbox', { name: 'Search Pride and Prejudice' });
  await search.fill('Bennet');
  const found = head.getByRole('button', { name: /^Found \d+$/u });
  await expect(found).toHaveAttribute('aria-pressed', 'true');
  await laidAsABook(head);
  // Three lenses, still one row of them in a Fold's list.
  const tops = await head
    .getByRole('button')
    .evaluateAll((lenses) => lenses.map((lens) => Math.round(lens.getBoundingClientRect().top)));
  expect(tops).toHaveLength(3);
  expect(new Set(tops).size).toBe(1);
  // Nothing searched, nothing to choose: no Found at all, Contents the lens pressed.
  await search.fill('');
  await expect(head.getByRole('button', { name: /^Found/u })).toHaveCount(0);
  await expect(head.getByRole('button', { name: /^Contents \d+$/u })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
