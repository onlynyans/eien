// Facing pages (spec §4, Split; docs/split-and-windows.md phase 6): one sheet
// opened like a book. Each note's own tools and figures in its folio, the
// book's tools at the top, the active page marked in the way the setting says,
// and too narrow, the book closed to one page with the other's edge to turn to.

import type { Page } from '@playwright/test';
import { chooseSetting, expect, test } from './launch';

const row = (page: Page, title: string) => page.locator('.note-row', { hasText: title });
const leaves = (page: Page) => page.locator('.page__pages > .page__leaf');
const active = (page: Page) => page.locator('.page__pages > .page__leaf[data-active]');

async function split(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await row(page, 'Chapter').click();
  await expect(active(page).locator('.cm-content')).toContainText('The gate held.');
  await row(page, 'Notes').click({ modifiers: ['ControlOrMeta'] });
  await expect(leaves(page)).toHaveCount(2);
}

test.describe('facing pages', () => {
  test.use({
    vaultFiles: { 'Chapter.md': 'The gate held.\n', 'Notes.md': 'Snow on the walls.\n' },
    deviceFile: { settings: { 'appearance.split': 'facing' } },
  });

  test('opens as one book, each page with its own folio and tools, the book’s at the top', async ({
    page,
  }) => {
    await split(page);
    await expect(page.locator('html')).toHaveAttribute('data-split', 'facing');
    const folios = page.locator('.page__folio');
    await expect(folios).toHaveCount(2);
    await expect(folios.nth(0)).toContainText('3 words');
    await expect(folios.nth(1)).toContainText('4 words');
    for (const n of [0, 1])
      await expect(folios.nth(n).getByRole('button', { name: 'Compare' })).toHaveCount(1);
    // The note's own tools left the top; the book's swap joined it.
    await expect(
      page.locator('.page__bar [data-command="compare"], .window-head [data-command="compare"]'),
    ).toHaveCount(0);
    await expect(page.locator('[data-command="pages.swap"]:visible')).toHaveCount(1);
  });

  test('a page’s own Close closes it, and the book becomes a sheet again', async ({ page }) => {
    await split(page);
    await leaves(page).nth(0).hover();
    await leaves(page).nth(0).getByRole('button', { name: 'Close this page' }).click();
    await expect(leaves(page)).toHaveCount(1);
    await expect(page.locator('.page__folio:visible')).toHaveCount(0);
    await expect(page.locator('.colophon .colophon__words')).toHaveText('4 words');
  });

  test('marks the page you’re in, and the mark follows you to the other', async ({ page }) => {
    await split(page);
    await expect(active(page).locator('.page__mark--active')).toHaveCount(1);
    await expect(page.locator('.page__mark--active')).toHaveCount(1);
    await leaves(page).nth(0).locator('.cm-content').click();
    await expect(leaves(page).nth(0).locator('.page__mark--active')).toHaveCount(1);
    await expect(page.locator('.page__mark--active')).toHaveCount(1);
  });

  test('stands at the active page’s outer edge, each of the three marks', async ({ page }) => {
    await split(page);
    /** Which half of the active leaf the mark stands in. */
    const half = async () => {
      const leaf = await active(page).boundingBox();
      const mark = await active(page).locator('.page__mark--active').boundingBox();
      if (!leaf || !mark) throw new Error('no mark in sight');
      return mark.x + mark.width / 2 > leaf.x + leaf.width / 2 ? 'right' : 'left';
    };
    for (const mark of ['ribbon', 'dogear', 'tab'] as const) {
      await chooseSetting(page, 'appearance.facingMark', mark);
      await leaves(page).nth(1).locator('.cm-content').click();
      await expect.poll(half).toBe('right');
      await leaves(page).nth(0).locator('.cm-content').click();
      await expect.poll(half).toBe('left');
    }
  });

  test('wears each of the three marks the setting offers', async ({ page }) => {
    await split(page);
    for (const mark of ['ribbon', 'dogear', 'tab'] as const) {
      await chooseSetting(page, 'appearance.facingMark', mark);
      await expect(page.locator('html')).toHaveAttribute('data-facing-mark', mark);
      await expect(active(page).locator('.page__mark--active')).toBeVisible();
    }
  });

  test('closes to one page when narrow, the other’s edge turning to it', async ({ page }) => {
    await split(page);
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(page.locator('.page__pages[data-narrow="close"]')).toHaveCount(1);
    await expect(leaves(page).filter({ visible: true })).toHaveCount(1);
    const edge = page.getByRole('button', { name: 'Turn to Chapter, the facing page' });
    await edge.click();
    await expect(active(page).locator('.cm-content')).toContainText('The gate held.');
    await expect(
      page.getByRole('button', { name: 'Turn to Notes, the facing page' }),
    ).toBeVisible();
  });
});
