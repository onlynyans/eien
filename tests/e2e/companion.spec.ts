// Companion (spec §4, Split; docs/split-and-windows.md phase 7): the page as
// it always is, with every tool acting on it; the second note a companion at
// the window's right edge with its own head and foot, under the page when
// the pane is too narrow, and made the page with ⇄.

import type { Page } from '@playwright/test';
import { expect, test } from './launch';

const row = (page: Page, title: string) => page.locator('.note-row', { hasText: title });
const side = (page: Page, n: 0 | 1) => page.locator(`.page__pages > .page__leaf[data-side="${n}"]`);

async function split(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await row(page, 'Chapter').click();
  await expect(page.locator('.page__leaf[data-active] .cm-content')).toContainText('The gate');
  await row(page, 'Notes').click({ modifiers: ['ControlOrMeta'] });
  await expect(side(page, 1)).toBeVisible();
}

test.describe('a companion', () => {
  test.use({
    vaultFiles: { 'Chapter.md': 'The gate **held**.\n', 'Notes.md': 'Snow on the walls.\n' },
    deviceFile: { settings: { 'appearance.split': 'companion' } },
  });

  test('stands at the right edge, narrower, with its own head and foot', async ({ page }) => {
    await split(page);
    const companion = side(page, 1);
    await expect(companion.locator('.page__head')).toContainText('Notes');
    await expect(companion.locator('.page__folio')).toContainText('4 words');
    const [main, beside] = [await side(page, 0).boundingBox(), await companion.boundingBox()];
    expect(beside?.width).toBeLessThan(main?.width ?? 0);
    expect(Math.round(beside?.width ?? 0)).toBe(380);
    // The colophon stays the page's.
    await expect(page.locator('.colophon .colophon__words')).toHaveText('3 words');
  });

  test('lets the page’s tools act on the page while the writer is in the companion', async ({
    page,
  }) => {
    await split(page);
    await side(page, 1).locator('.cm-content').click(); // writing in the companion
    await page.locator('.page').hover();
    await page.locator('[data-command="view.source"]:visible').click();
    // The page shows its marks; the companion stays in Live.
    await expect(side(page, 0).locator('.cm-content')).toContainText('**held**');
    await expect(side(page, 1).locator('.cm-content')).toContainText('Snow on the walls.');
  });

  test('is made the page with ⇄, and closed with its ×', async ({ page }) => {
    await split(page);
    await side(page, 1).hover();
    await side(page, 1).getByRole('button', { name: 'Make it the page' }).click();
    await expect(side(page, 0).locator('.cm-content')).toContainText('Snow on the walls.');
    await expect(side(page, 1).locator('.page__head')).toContainText('Chapter');
    await side(page, 1).hover();
    await side(page, 1).getByRole('button', { name: 'Close this page' }).click();
    await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(1);
  });

  test('goes under the page when the pane is too narrow, and back beside it wider', async ({
    page,
  }) => {
    await split(page);
    await page.setViewportSize({ width: 1200, height: 900 }); // the page pane under 700 px
    await expect(page.locator('.page__pages[data-dock="under"]')).toHaveCount(1);
    const [main, beside] = [await side(page, 0).boundingBox(), await side(page, 1).boundingBox()];
    expect(beside?.y).toBeGreaterThan((main?.y ?? 0) + (main?.height ?? 0) - 2);
    await expect(page.getByRole('separator', { name: 'Between the two pages' })).toHaveAttribute(
      'aria-orientation',
      'horizontal',
    );
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect(page.locator('.page__pages[data-dock="under"]')).toHaveCount(0);
  });
});
