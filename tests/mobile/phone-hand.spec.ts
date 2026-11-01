// A finger turning a book's page on the phone (#40, Phase 3c), with real
// touches: CDP's Input.dispatchTouchEvent, so the browser's own touch
// handling runs (its implicit pointer capture, touch-action, its cancels),
// which synthetic PointerEvents skip. Motion on, so the hand holds a curl.

import { type CDPSession, devices, expect, type Page, test } from '@playwright/test';
import { bookInPages, box, firstWords, touchAt } from './book-hand';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

/**
 * Whether the curl is held under the finger: there, and still between two
 * looks (a curl let go or cancelled flies on, moving every frame).
 */
const held = async (page: Page): Promise<boolean> => {
  const back = page.locator('.turn-curl__back');
  // The last move's frame drawn first: a held curl is drawn once a frame, after the hand moves.
  await page.waitForTimeout(100);
  if ((await back.count()) === 0) return false;
  const before = await back.evaluate((element) => (element as HTMLElement).style.transform);
  await page.waitForTimeout(150);
  if ((await back.count()) === 0) return false;
  return before === (await back.evaluate((element) => (element as HTMLElement).style.transform));
};

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

test('a finger drawn a little holds the page, and lifted slowly lets it fall back, home', async ({
  page,
}) => {
  await bookInPages(page);
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const first = await firstWords(page);
  const cdp = await page.context().newCDPSession(page);
  const y = rect.y + rect.height / 2;
  const x = rect.x + rect.width * 0.6;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchAt(x, y) });
  for (let i = 1; i <= 30; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touchAt(x - i, y),
    });
  }
  // Still under the finger as it's lifted: never cancelled by the browser on the way.
  expect(await held(page)).toBe(true);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.turn-curl')).toHaveCount(0);
  expect(await firstWords(page)).toBe(first);
});

test('a gesture the system cancels lets the page fall back home, flying', async ({ page }) => {
  await bookInPages(page);
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const first = await firstWords(page);
  const cdp = await page.context().newCDPSession(page);
  const y = rect.y + rect.height / 2;
  const x = rect.x + rect.width * 0.8;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchAt(x, y) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touchAt(x - i * 30, y),
    });
  }
  expect(await held(page)).toBe(true);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  // Home, not snatched away: the curl is still there, flying back, then goes.
  await expect(page.locator('.turn-curl')).toHaveCount(1);
  await expect(page.locator('.turn-curl')).toHaveCount(0);
  expect(await firstWords(page)).toBe(first);
});
