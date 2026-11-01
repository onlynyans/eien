// A book's page takes the height it's given on a phone (#58): its sheet's
// foot margin is its head's, not a desk's 72px, in Pages and in Scroll, with
// the toolbar in sight or folded away; the sheet ends a gutter above the
// colophon, as it begins a gutter under the bar.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');

for (const view of ['pages', 'scroll'] as const) {
  for (const layout of ['band', 'slip', 'runhead'] as const) {
    test(`in ${view}, ${layout}: the sheet’s foot margin is its head’s`, async ({ page }) => {
      await open(page);
      await page.evaluate(
        async ([view, layout]) => {
          await window.eien.settings.set('epub.view', view);
          await window.eien.settings.set('appearance.layout', layout);
        },
        [view, layout] as const,
      );
      await putBytesOutside(
        page,
        'Eien/Vault/Novels/Pride and Prejudice.epub',
        readFileSync(FIXTURE).toString('base64'),
      );
      // A Galaxy Z Fold 5 opened upright.
      await page.setViewportSize({ width: 590, height: 706 });
      await page.reload();
      const back = page.locator('.phone-bar__back');
      const row = page.locator('.tree-row--epub .tree-row__name');
      await expect
        .poll(async () => (await row.isVisible()) || (await back.isVisible()), { timeout: 10_000 })
        .toBe(true);
      if (!(await row.isVisible())) await back.click();
      await row.click();
      await expect(page.locator('.epub-chapter')).toContainText('It is a truth');
      const sheet = page.locator('.epub-sheet:not([aria-hidden])');
      const margins = await sheet.evaluate((element) => {
        const style = getComputedStyle(element);
        return { head: style.paddingTop, foot: style.paddingBottom };
      });
      expect(margins.foot).toBe(margins.head);
      if (view === 'pages') {
        // The sheet ends a gutter above the colophon, as it begins one under the bar.
        const gaps = await sheet.evaluate((element) => {
          const scroll = element.closest('.page__scroll') as HTMLElement;
          const [at, within] = [element.getBoundingClientRect(), scroll.getBoundingClientRect()];
          return { above: at.top - within.top, below: within.bottom - at.bottom };
        });
        expect(gaps.below).toBeCloseTo(gaps.above, 0);
      }
    });
  }
}

/** The book open in Pages on a Fold's upright screen, and its sheet's head and foot margins, in px. */
async function sheetMargins(page: Page) {
  await open(page);
  await page.evaluate(() => window.eien.settings.set('epub.view', 'pages'));
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await page.setViewportSize({ width: 590, height: 706 });
  await page.reload();
  const back = page.locator('.phone-bar__back');
  const row = page.locator('.tree-row--epub .tree-row__name');
  await expect
    .poll(async () => (await row.isVisible()) || (await back.isVisible()), { timeout: 10_000 })
    .toBe(true);
  if (!(await row.isVisible())) await back.click();
  await row.click();
  await expect(page.locator('.epub-chapter')).toContainText('It is a truth');
  return page.locator('.epub-sheet:not([aria-hidden])').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      coarse: matchMedia('(pointer: coarse)').matches,
      head: Number.parseFloat(style.paddingTop),
      foot: Number.parseFloat(style.paddingBottom),
    };
  });
}

test('the foot is the head’s where a finger reads; with a mouse it keeps the desk’s room', async ({
  page,
  browser,
}) => {
  const finger = await sheetMargins(page);
  expect(finger.coarse).toBe(true);
  expect(finger.foot).toBe(finger.head);
  // The same screen with a mouse and no touch: a desktop's window as narrow, its sheet as a note's.
  const desk = await browser.newContext({
    ...devices['Desktop Chrome'],
    hasTouch: false,
    isMobile: false,
    reducedMotion: 'reduce',
  });
  try {
    const mouse = await sheetMargins(await desk.newPage());
    expect(mouse.coarse).toBe(false);
    expect(mouse.foot).toBe(72);
    expect(mouse.foot).toBeGreaterThan(mouse.head);
  } finally {
    await desk.close();
  }
});
