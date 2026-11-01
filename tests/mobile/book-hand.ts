// A book in pages on the phone, and a finger on it: what the specs of a
// hand on the page share (./phone-hand.spec.ts, ./curl-layers.spec.ts).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { open, putBytesOutside } from './outside';

export const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');
export const back = (page: Page) => page.locator('.phone-bar__back');
export const box = (page: Page) => page.locator('.epub-sheet:not([aria-hidden]) .epub__pages');

/** The first words on the page in sight. */
export const firstWords = (page: Page) =>
  box(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const at = document.caretRangeFromPoint(rect.left + 2, rect.top + 4);
    return at?.startContainer.textContent?.slice(at.startOffset, at.startOffset + 30) ?? '';
  });

/** A book open in pages on the phone. */
export async function bookInPages(page: Page): Promise<void> {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await back(page).click();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await page.locator('.phone-bar__controls [data-command="look"]').click();
  await page.locator('[data-setting="epub.view"] [data-value="pages"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.page__leaf--epub')).toHaveAttribute('data-view', 'pages');
}

/** One finger's touch at (x, y), for CDP's Input.dispatchTouchEvent. */
export const touchAt = (x: number, y: number) => [
  { x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 },
];
