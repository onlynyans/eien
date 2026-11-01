// A link on a phone (backlog #38): no hover, so a tap puts the caret in the
// link and its bar comes, the phone's default, docked over the colophon above
// where the keyboard comes, its targets a finger's size; its field edits
// where the link goes.

import { devices, expect, test } from '@playwright/test';
import { open, putOutside, readOutside, titles } from './outside';

test.use({ ...devices['Pixel 7'] });

const PATH = 'Eien/Vault/Plan.md';
const NOTE = 'Read [AO3](https://archiveofourown.org/works/1) tonight.\n\nAfter.\n';

test('a tap in a link brings its bar, docked, and its field edits where it goes', async ({
  page,
}) => {
  await open(page);
  await putOutside(page, PATH, NOTE);
  await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
  await titles(page).first().tap();
  const bar = page.getByRole('toolbar', { name: 'Link to archiveofourown.org/works/1' });
  await expect(bar).toBeHidden();

  await page.locator('.eien-link', { hasText: 'AO3' }).tap();
  await expect(bar).toBeVisible();
  // Docked above the keyboard, as the table's bar is, and nothing floats over the words.
  await expect(
    page.locator('.page__under').getByRole('toolbar', { name: /^Link to/ }),
  ).toBeVisible();
  await expect(page.locator('.link-card:not([hidden])')).toHaveCount(0);
  for (const button of await bar.getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await bar.getByRole('button', { name: 'Edit where it goes' }).tap();
  const goes = page.getByRole('textbox', { name: /^Goes to/ });
  await expect(goes).toBeFocused();
  await goes.fill('https://ao3.org');
  await goes.press('Enter');
  await expect
    .poll(() => readOutside(page, PATH), { timeout: 5000 })
    .toBe('Read [AO3](https://ao3.org) tonight.\n\nAfter.\n');

  await page.locator('.cm-line', { hasText: 'After.' }).tap();
  await expect(page.locator('.link-bar:not([hidden])')).toHaveCount(0);
});
