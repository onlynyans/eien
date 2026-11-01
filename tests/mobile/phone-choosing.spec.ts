// Choosing words in a book by touch (#65): Chromium's own long press
// (CDP's Input.synthesizeTapGesture held a second), so the browser's touch,
// its gesture and its choosing of the word run as on Android. Eien's actions
// then dock at the page's foot, over the colophon.

import { type CDPSession, devices, expect, type Locator, type Page, test } from '@playwright/test';
import { bookInPages, box, firstWords } from './book';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

const bar = (page: Page) => page.locator('.epub__under .selection-bar--docked');

/** The words chosen now. */
const chosen = (page: Page) => page.evaluate(() => document.getSelection()?.toString() ?? '');

/** A finger held a second in the middle of `area` (the page in sight), and lifted: the system's long press. */
async function pressAndHold(
  page: Page,
  cdp: CDPSession,
  area: Locator = box(page),
): Promise<string> {
  const rect = await area.boundingBox();
  if (!rect) throw new Error('no page');
  await cdp.send('Input.synthesizeTapGesture', {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 3,
    duration: 1000,
    gestureSourceType: 'touch',
  });
  return chosen(page);
}

/** Words at `x`, `y` chosen by script, as a long press leaves them. */
const choose = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([x, y]) => {
      const at = document.caretRangeFromPoint(x, y);
      const node = at?.startContainer;
      if (!at || !(node instanceof Text)) return;
      document.getSelection()?.setBaseAndExtent(node, 0, node, node.data.length);
    },
    [x, y] as const,
  );

const height = (page: Page) =>
  box(page).evaluate((element) => (element as HTMLElement).offsetHeight);

test('in Pages a long press chooses words, the page held still; Eien’s actions dock at its foot', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await bookInPages(page);
  const first = await firstWords(page);
  const tall = await height(page);
  const cdp = await page.context().newCDPSession(page);

  expect(await pressAndHold(page, cdp)).not.toBe('');
  await expect(bar(page)).toBeVisible();
  await expect(page.locator('.turn-curl')).toHaveCount(0);
  expect(await firstWords(page)).toBe(first);
  await expect(bar(page).getByRole('button')).toHaveText([
    'Highlight',
    'Quote in the note',
    'Copy',
  ]);
  // Over the colophon, its foot the colophon's, a finger's height: the pages never laid out anew.
  const docked = await bar(page).boundingBox();
  const colophon = await page.locator('.colophon').boundingBox();
  expect(
    docked && colophon && Math.abs(docked.y + docked.height - (colophon.y + colophon.height)),
  ).toBeLessThan(1);
  expect(docked?.height).toBeGreaterThanOrEqual(44);
  expect(await height(page)).toBe(tall);

  // Copy gives the words alone, and lets the choice go.
  const words = await chosen(page);
  await bar(page).getByRole('button', { name: 'Copy' }).tap();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(words);
  await expect(bar(page)).toBeHidden();
  expect(await page.evaluate(() => document.getSelection()?.isCollapsed)).toBe(true);

  // Highlight keeps them, the page still where it was.
  expect(await pressAndHold(page, cdp)).not.toBe('');
  await bar(page).getByRole('button', { name: 'Highlight' }).tap();
  await expect(page.locator('.epub-chapter [data-highlighted]')).toHaveCount(1);
  await expect(bar(page)).toBeHidden();
  expect(await firstWords(page)).toBe(first);
});

test('a tap that lets a choice go never turns the page', async ({ page }) => {
  await bookInPages(page);
  const first = await firstWords(page);
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  // Words chosen on the page, as a long press leaves them.
  await choose(page, rect.x + rect.width / 2, rect.y + rect.height / 3);
  expect(await chosen(page)).not.toBe('');
  // The system drops the choice as the finger comes down in the right third, before its click.
  await page.evaluate(() => {
    addEventListener('pointerdown', () => document.getSelection()?.removeAllRanges(), {
      once: true,
    });
  });
  await page.touchscreen.tap(rect.x + rect.width * 0.9, rect.y + rect.height / 2);
  await page.waitForTimeout(300);
  expect(await firstWords(page)).toBe(first);
  // The next tap there turns it, as ever.
  await page.touchscreen.tap(rect.x + rect.width * 0.9, rect.y + rect.height / 2);
  await expect.poll(() => firstWords(page)).not.toBe(first);
});

test('in Scroll the system’s choosing docks the same bar', async ({ page }) => {
  await bookInPages(page);
  await page.locator('.phone-bar__controls [data-command="look"]').click();
  await page.locator('[data-setting="epub.view"] [data-value="scroll"]').click();
  await page.keyboard.press('Escape');
  const scroller = page.locator('.page__leaf--epub .page__scroll');
  const cdp = await page.context().newCDPSession(page);
  expect(await pressAndHold(page, cdp, scroller)).not.toBe('');
  await expect(bar(page)).toBeVisible();
  // The words scroll with their choice: the bar stays.
  await scroller.evaluate((element) => {
    element.scrollTop += 40;
  });
  await page.waitForTimeout(300);
  await expect(bar(page)).toBeVisible();
});
