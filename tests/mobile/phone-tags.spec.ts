// Tags on a phone's page (backlog #13): label slips under the title in every
// layout, big enough for a finger, their × and + always in sight (there's
// no hover). Added and taken off in front matter alone, as on the desktop;
// a tag typed in the words has no ×. No formatting bar: the selection's bar
// formats on a phone.

import { devices, expect, type Page, test } from '@playwright/test';
import { open, putOutside, readOutside, titles } from './outside';

test.use({ ...devices['Pixel 7'] });

const NOTE = '---\ntags: [fic]\n---\nOn the wall. #draft\n';
const PATH = 'Eien/Vault/Wall.md';

async function onPage(page: Page): Promise<void> {
  await open(page);
  await putOutside(page, PATH, NOTE);
  await putOutside(page, 'Eien/Vault/Other.md', '---\ntags: [posted]\n---\nMore.\n');
  await expect(titles(page)).toHaveCount(2, { timeout: 10_000 });
  await titles(page).filter({ hasText: 'Wall' }).click();
  await expect(page.locator('.title')).toHaveText('Wall');
}

/** Choose `layout` in Settings, from the page's ⋯. */
async function chooseLayout(page: Page, layout: string): Promise<void> {
  await page.getByRole('button', { name: 'More' }).click();
  await page.locator('.menu [role^="menuitem"]', { hasText: /^Settings$/ }).click();
  const dialog = page.locator('dialog[open]');
  await dialog.locator(`[data-value="${layout}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('data-layout', layout);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

for (const layout of ['band', 'slip', 'runhead'] as const) {
  test(`the ${layout} layout: slips under the title, added and taken off by a finger`, async ({
    page,
  }) => {
    await onPage(page);
    if (layout !== 'band') await chooseLayout(page, layout);
    const slips = page.locator('.title-tags .tag-set');
    await expect(slips).toBeVisible();
    await expect(page.locator('.tag-set')).toHaveCount(1); // not in the running head, nor the colophon
    await expect(slips.locator('.tag')).toHaveText(['#fic', '#draft']);
    // Under the title, a finger's size, with nothing to hover for.
    const title = await page.locator('.title').boundingBox();
    const box = await slips.boundingBox();
    expect(box?.y ?? 0).toBeGreaterThan((title?.y ?? 0) + (title?.height ?? 0) - 1);
    for (const control of [
      slips.getByRole('button', { name: 'Take #fic off' }),
      slips.getByRole('button', { name: 'Add a tag' }),
    ]) {
      await expect(control).toBeVisible();
      const size = await control.boundingBox();
      expect(size?.height ?? 0).toBeGreaterThanOrEqual(40);
      expect(size?.width ?? 0).toBeGreaterThanOrEqual(40);
    }
    await expect(slips.getByRole('button', { name: 'Take #draft off' })).toHaveCount(0);

    // Add the vault's other tag from the menu.
    await slips.getByRole('button', { name: 'Add a tag' }).tap();
    await slips.getByRole('combobox', { name: 'Add a tag' }).fill('po');
    await page.getByRole('option', { name: /^#posted/ }).tap();
    await expect(slips.locator('.tag')).toHaveText(['#fic', '#posted', '#draft']);
    await expect
      .poll(() => readOutside(page, PATH), { timeout: 5000 })
      .toBe('---\ntags: [fic, posted]\n---\nOn the wall. #draft\n');

    // Take one off: front matter changes, the words don't.
    await slips.getByRole('button', { name: 'Take #fic off' }).tap();
    await expect
      .poll(() => readOutside(page, PATH), { timeout: 5000 })
      .toBe('---\ntags: [posted]\n---\nOn the wall. #draft\n');
    await expect(slips.locator('.tag')).toHaveText(['#posted', '#draft']);

    // No formatting bar, nor a control for one, on a phone.
    await expect(page.getByRole('toolbar', { name: 'Format' })).toBeHidden();
    await expect(page.locator('[data-command="format-bar"]:visible')).toHaveCount(0);
  });
}
