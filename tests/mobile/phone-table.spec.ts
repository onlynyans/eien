// A table on a phone (spec §4, Tables): no grips or + to aim at with a
// finger, but the table's tools on one bar at the page's foot, above where
// the keyboard comes, while the caret is in the table.

import { devices, expect, test } from '@playwright/test';
import { open, putOutside, readOutside, titles } from './outside';

test.use({ ...devices['Pixel 7'] });

const PATH = 'Eien/Vault/Plan.md';
const NOTE = 'Plan.\n\n| Who | When |\n|---|---|\n| Mara | 30 |\n\nAfter.\n';

test('the table bar comes with the caret in a table, and its tools change the file', async ({
  page,
}) => {
  await open(page);
  await putOutside(page, PATH, NOTE);
  await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
  await titles(page).first().click();
  const bar = page.getByRole('toolbar', { name: 'Table' });
  await expect(bar).toBeHidden();
  await expect(page.getByRole('button', { name: /menu, or drag to move/ }).first()).toBeHidden();

  await page.locator('.eien-cell', { hasText: 'Mara' }).click();
  await expect(bar).toBeVisible();
  const tool = (name: string) => bar.getByRole('button', { name });
  await expect(tool('Remove this row')).toHaveAttribute('aria-disabled', 'false');
  await tool('Add a row below').click();
  await expect
    .poll(() => readOutside(page, PATH), { timeout: 5000 })
    .toContain('| Mara | 30 |\n|  |  |\n');
  // The caret's column: the new row's first cell, under Who.
  await tool('Align the column right').click();
  await expect.poll(() => readOutside(page, PATH), { timeout: 5000 }).toContain('|---:|---|');

  await page.locator('.cm-line', { hasText: 'After.' }).click();
  await expect(bar).toBeHidden();
});
