// Interface zoom on a phone (spec §6): the whole interface smaller or larger,
// laid out again at the width it leaves, as a browser zooms, from Settings'
// stepper; kept, and worn from the start.

import { devices, expect, type Page, test } from '@playwright/test';
import { open, putOutside, threePanes, titles } from './outside';

test.use({ ...devices['Pixel 7'] });

/** Settings › Look › Appearance › Interface zoom, a step `by` (−1 smaller, +1 larger), `times`. */
async function zoomBy(page: Page, by: 1 | -1, times: number): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  await sheet
    .getByRole('navigation')
    .getByRole('button', { name: 'Appearance', exact: true })
    .click();
  const zoom = sheet.locator('[data-setting="window.zoom"]');
  await expect(zoom).toBeVisible();
  for (let step = 0; step < times; step++)
    await zoom.getByRole('button', { name: by < 0 ? 'Smaller' : 'Larger' }).click();
  await sheet.getByRole('button', { name: 'Close settings' }).click();
}

/** The page's width and scale now, and whether anything runs past it. */
const measure = (page: Page) =>
  page.evaluate(() => ({
    width: innerWidth,
    scale: Math.round((window.visualViewport?.scale ?? 0) * 100) / 100,
    over: document.documentElement.scrollWidth - innerWidth,
  }));

test.beforeEach(async ({ page }) => {
  await open(page);
  await threePanes(page);
  await putOutside(page, 'Eien/Vault/Ideas.md', 'An idea.\n');
  await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
  await page.locator('.phone-bar__back').click(); // the contents, with Settings at their foot
});

test('zoomed out, everything is smaller and the page is laid out wider: more room', async ({
  page,
}) => {
  expect(await measure(page)).toEqual({ width: 412, scale: 1, over: 0 });
  await zoomBy(page, -1, 2); // 80%
  await expect.poll(() => measure(page)).toEqual({ width: 515, scale: 0.8, over: 0 });
  // Kept, and worn from the start.
  await page.reload();
  await expect.poll(() => measure(page)).toEqual({ width: 515, scale: 0.8, over: 0 });
});

test('zoomed in, everything is larger and laid out again: nothing runs past the screen', async ({
  page,
}) => {
  await zoomBy(page, 1, 5); // 150%
  await expect.poll(() => measure(page)).toEqual({ width: 275, scale: 1.5, over: 0 });
});

test('a Galaxy Z Fold 5 sideways at 80% gives the page more room beside the panes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 706, height: 590 }); // Panes, the default room
  await titles(page).first().click();
  const pageWidth = () => page.locator('.shell > .page').evaluate((pane) => pane.clientWidth);
  const before = await pageWidth(); // the panes giving way, the page squeezed
  await zoomBy(page, -1, 2);
  await expect.poll(() => measure(page)).toMatchObject({ width: 882, scale: 0.8, over: 0 });
  await expect.poll(pageWidth).toBeGreaterThan(before + 40);
});

test('at 200%, the most, it’s laid out again still, and Settings is in reach to come back', async ({
  page,
}) => {
  await zoomBy(page, 1, 10);
  await expect.poll(() => measure(page)).toEqual({ width: 206, scale: 2, over: 0 });
  await zoomBy(page, -1, 10); // back to 100% from Settings at 200%
  await expect.poll(() => measure(page)).toEqual({ width: 412, scale: 1, over: 0 });
});
