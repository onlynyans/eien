// SHELF on the phone (#56): a folder's twisty turns as the folder opens and
// shuts, as FOLDERS' does, though the twisty there is the pointer's alone
// and its folder's name holds the state for assistive tech.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Locator, test } from '@playwright/test';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');

/** How far the twisty's triangle is turned, in whole degrees: 90 points down, 0 to the right. */
const turned = (twisty: Locator) =>
  twisty.evaluate((element) => {
    const { transform } = getComputedStyle(element.querySelector('.twisty') as Element, '::before');
    if (transform === 'none') return 0;
    const [a = 1, b = 0] = transform
      .slice(transform.indexOf('(') + 1)
      .split(',')
      .map(Number);
    return Math.round((Math.atan2(b, a) * 180) / Math.PI);
  });

test('a SHELF folder’s twisty points down while it’s open and to the right once it’s shut', async ({
  page,
}) => {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await page.locator('.phone-bar__back').click(); // the list's back: the sidebar
  const book = page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' });
  await expect(book).toBeVisible({ timeout: 10_000 });
  const folder = page.locator('[data-key="shelf:Novels"]');
  const twist = page.locator('[data-key="twist:/shelf/Novels"]');
  await expect(folder).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => turned(twist)).toBe(90);
  // Shut by its twisty: the tree is drawn again, the twisty with it.
  await twist.click();
  await expect(book).toHaveCount(0);
  await expect(folder).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => turned(twist)).toBe(0);
  // Opened again by its name, the keyboard's and assistive tech's control.
  await folder.click();
  await expect(book).toBeVisible();
  await expect.poll(() => turned(twist)).toBe(90);
});
