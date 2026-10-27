// axe-core over the phone's page (../e2e/axe.ts): each layout, by day and by
// night, on the notes, the page, its table bar, its ⋯ menu and Settings. No
// serious or critical violation, colour contrast included.

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
      await putOutside(
        page,
        'Eien/Vault/Ideas.md',
        '# Ideas\n\nAn *idea*, #draft.\n\n| Who | When |\n|---|--:|\n| Mara | 30 |\n',
      );
      await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
      await titles(page).first().click();
      await expect(page.locator('.title')).toHaveText('Ideas');

      await openSettings(page);
      const settings = page.locator('dialog[open]');
      // The Layout choice itself: the Running head's strip ground has a swatch called Band too.
      await settings
        .getByRole('group', { name: 'Layout' })
        .locator(`[data-value="${layout}"]`)
        .click();
      await settings.locator(`[data-value="${scheme}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('data-layout', layout);
      expect(await seriousViolations(page), 'Settings').toEqual([]);
      await page.keyboard.press('Escape');
      await expect(settings).toBeHidden();

      expect(await seriousViolations(page), 'the page').toEqual([]);
      await page.locator('.eien-cell', { hasText: 'Mara' }).click();
      await expect(page.getByRole('toolbar', { name: 'Table' })).toBeVisible();
      expect(await seriousViolations(page), 'the table bar').toEqual([]);
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

// Wide screen (spec §10): a tablet sideways, side by side.
for (const scheme of ['day', 'night'] as const) {
  test(`wide screen, side by side by ${scheme}: the pane you came from beside the one you’re in`, async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(async (scheme) => {
      await window.eien.settings.set('appearance.room', 'side');
      await window.eien.settings.set('appearance.scheme', scheme);
    }, scheme);
    await putOutside(page, 'Eien/Vault/Ideas.md', '# Ideas\n\nAn *idea*, #draft.\n');
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.reload();
    await expect(page.locator('.shell')).toHaveAttribute('data-room', 'side');
    await titles(page).first().click();
    await expect(page.locator('.page .title')).toHaveText('Ideas');
    expect(await seriousViolations(page), 'the page').toEqual([]);
    await page.locator('.phone-bar__back').click();
    await expect(titles(page)).toBeVisible();
    expect(await seriousViolations(page), 'the contents beside the notes').toEqual([]);
  });
}
