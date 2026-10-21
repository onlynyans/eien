// axe-core over the phone's page (../e2e/axe.ts): each layout, by day and by
// night, on the notes, the page, its ⋯ menu and Settings. No serious or
// critical violation, colour contrast included.

import { devices, expect, type Page, test } from '@playwright/test';
import { seriousViolations } from '../e2e/axe';
import { open, putOutside, titles } from './outside';

// Motion reduced from the start, so no fade is under way when axe looks (../e2e/axe.ts).
test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

/** Settings, from the page's ⋯. */
async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'More' }).click();
  await page.locator('.menu [role^="menuitem"]', { hasText: /^Settings$/ }).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
}

for (const layout of ['band', 'slip', 'runhead'] as const) {
  for (const scheme of ['day', 'night'] as const) {
    test(`${layout} by ${scheme}: the notes, the page, its menu and Settings`, async ({ page }) => {
      await open(page);
      await putOutside(page, 'Eien/Vault/Ideas.md', '# Ideas\n\nAn *idea*, #draft.\n');
      await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
      await titles(page).first().click();
      await expect(page.locator('.title')).toHaveText('Ideas');

      await openSettings(page);
      const settings = page.locator('dialog[open]');
      await settings.locator(`[data-value="${layout}"]`).click();
      await settings.locator(`[data-value="${scheme}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('data-layout', layout);
      expect(await seriousViolations(page), 'Settings').toEqual([]);
      await page.keyboard.press('Escape');
      await expect(settings).toBeHidden();

      expect(await seriousViolations(page), 'the page').toEqual([]);
      await page.getByRole('button', { name: 'More' }).click();
      await expect(page.locator('.menu')).toBeVisible();
      expect(await seriousViolations(page), 'the ⋯ menu').toEqual([]);
      await page.keyboard.press('Escape');

      await page.locator('.phone-bar__back').click();
      await expect(titles(page)).toBeVisible();
      expect(await seriousViolations(page), 'the notes').toEqual([]);
    });
  }
}
