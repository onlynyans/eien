// A finger turning a book's page on the phone (#40, Phase 3c), with real
// touches: CDP's Input.dispatchTouchEvent, so the browser's own touch
// handling runs (its implicit pointer capture, touch-action, its cancels),
// which synthetic PointerEvents skip. Motion on, so the hand holds a curl.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type CDPSession, devices, expect, type Page, test } from '@playwright/test';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');
const back = (page: Page) => page.locator('.phone-bar__back');
const box = (page: Page) => page.locator('.epub-sheet:not([aria-hidden]) .epub__pages');

/** The first words on the page in sight. */
const firstWords = (page: Page) =>
  box(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const at = document.caretRangeFromPoint(rect.left + 2, rect.top + 4);
    return at?.startContainer.textContent?.slice(at.startOffset, at.startOffset + 30) ?? '';
  });

/** A book open in pages on the phone. */
async function bookInPages(page: Page): Promise<void> {
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

/** One finger down at `from`, drawn to `to` in `steps`, and lifted: the browser's own touch. */
async function swipe(
  cdp: CDPSession,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps: number,
): Promise<void> {
  const point = (x: number, y: number) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point(from.x, from.y),
  });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x, y) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('a finger drawn across the words, well inside the screen, turns the page', async ({
  page,
}) => {
  await bookInPages(page);
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const first = await firstWords(page);
  const cdp = await page.context().newCDPSession(page);
  const y = rect.y + rect.height / 2;
  // From the page's right two-thirds to its left third: on.
  await swipe(cdp, { x: rect.x + rect.width * 0.7, y }, { x: rect.x + rect.width * 0.1, y }, 12);
  await expect(page.locator('.turn-curl')).toHaveCount(0);
  await expect.poll(() => firstWords(page)).not.toBe(first);
});

test('a finger drawn a little and lifted slowly lets the page fall back, home', async ({
  page,
}) => {
  await bookInPages(page);
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const first = await firstWords(page);
  const cdp = await page.context().newCDPSession(page);
  const y = rect.y + rect.height / 2;
  const x = rect.x + rect.width * 0.6;
  await swipe(cdp, { x, y }, { x: x - 30, y }, 30);
  await expect(page.locator('.turn-curl')).toHaveCount(0);
  expect(await firstWords(page)).toBe(first);
});

test('a gesture the system cancels lets the page fall back home', async ({ page }) => {
  await bookInPages(page);
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const first = await firstWords(page);
  const cdp = await page.context().newCDPSession(page);
  const y = rect.y + rect.height / 2;
  const x = rect.x + rect.width * 0.8;
  const point = (at: number) => [{ x: at, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(x - i * 30),
    });
  }
  await expect(page.locator('.turn-curl')).toHaveCount(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  // Home, not snatched away: the curl flies back, then goes.
  await expect(page.locator('.turn-curl')).toHaveCount(0);
  expect(await firstWords(page)).toBe(first);
});
