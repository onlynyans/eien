// The phone's other note (spec §10; docs/split-and-windows.md phase 9): no
// split on a phone, but the back bar keeps the note you came from a tap away,
// ⇄ and its name, and each note keeps its place; the phone's menus offer no
// split.

import { devices, expect, type Page, test } from '@playwright/test';
import { open, putOutside, titles } from './outside';

test.use({ ...devices['Pixel 7'] });

const back = (page: Page) => page.locator('.phone-bar__back');
const other = (page: Page) => page.locator('.phone-bar__other');
const LONG = Array.from({ length: 80 }, (_, i) => `A long chapter's line ${i}.`).join('\n\n');

async function withNotes(page: Page): Promise<void> {
  await open(page);
  await putOutside(page, 'Eien/Vault/Chapter.md', `${LONG}\n`);
  await putOutside(page, 'Eien/Vault/Notes.md', 'Erwin: speaks last in any room.\n');
  await expect(titles(page)).toHaveCount(2, { timeout: 10_000 });
}

test('the note you came from is a tap away, and each keeps its place', async ({ page }) => {
  await withNotes(page);
  await titles(page).filter({ hasText: 'Chapter' }).click();
  await expect(page.locator('.title')).toHaveText('Chapter');
  await expect(other(page)).toBeHidden(); // nothing to go back to yet
  const scroll = page.locator('.page__scroll');
  await scroll.evaluate((element) => {
    element.scrollTop = 900;
  });
  await back(page).click();
  await titles(page).filter({ hasText: 'Notes' }).click();
  await expect(page.locator('.title')).toHaveText('Notes');
  await expect(other(page)).toBeVisible();
  await expect(other(page)).toHaveAccessibleName('Switch to the other note: Chapter');
  await other(page).click();
  await expect(page.locator('.title')).toHaveText('Chapter');
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(800);
  // The one you left is the other note now.
  await expect(other(page)).toHaveAccessibleName('Switch to the other note: Notes');
  await back(page).click();
  await expect(other(page)).toBeHidden(); // only with the page in sight
});

test('the phone’s menus offer no split', async ({ page }) => {
  await withNotes(page);
  await titles(page).filter({ hasText: 'Notes' }).click({ button: 'right' });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Open to the Side' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await titles(page).filter({ hasText: 'Notes' }).click();
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('menu', { name: 'More' })).not.toContainText(/Split|Swap|Side/);
});
