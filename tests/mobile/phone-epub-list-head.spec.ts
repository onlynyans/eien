// A book's head in the list (#61): its title across the whole line, its
// author under it, and the lenses a row of their own under that, never
// crowding the author; Found only once a search has found something.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from '@playwright/test';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');

test('a book’s head: the title across the line, the author under it, the lenses under that', async ({
  page,
}) => {
  await open(page);
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
  await back.click();
  const head = page.locator('.list__head:has(.book-lenses)');
  await expect(head).toBeVisible();
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
  // The title's line runs to the head's own edge.
  expect(boxes.title?.right).toBeCloseTo(boxes.inner, 0);
  expect(boxes.author?.top).toBeGreaterThanOrEqual(boxes.title?.bottom ?? Number.POSITIVE_INFINITY);
  expect(boxes.lenses?.top).toBeGreaterThanOrEqual(
    boxes.author?.bottom ?? Number.POSITIVE_INFINITY,
  );
  await expect(head.getByRole('button')).toHaveText([/^Contents \d+$/u, /^Marks \d+$/u]);
});
