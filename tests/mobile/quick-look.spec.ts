// The quick look on the phone (backlog #49): the Look control in each
// layout's phone bottom, and the ⋯'s Look, open a sheet from the screen's
// foot, no scrim, a finger's size. A change shows at once; Done, or the
// system's back, closes it. Wide screen's Panes is the desktop's window, so
// there it's the desktop's column; One at a time is the phone's sheet.

import { devices, expect, type Page, test } from '@playwright/test';
import { catchBackButton, open, putOutside, systemBack, threePanes, titles } from './outside';

test.use({ ...devices['Pixel 7'] });
test.beforeEach(({ page }) => catchBackButton(page));

const look = (page: Page) => page.getByRole('dialog', { name: 'Look: Notes' });
const phoneControl = (page: Page) =>
  page.locator('.phone-bar__controls [data-command="look"], .page__phone [data-command="look"]');

/** A note open on the phone's page, in `layout`, the room chosen. */
async function onPage(page: Page, layout = 'band', room = 'panes'): Promise<void> {
  await open(page);
  await threePanes(page);
  await page.evaluate(
    async ([layout, room]) => {
      await window.eien.settings.set('appearance.layout', layout as never);
      await window.eien.settings.set('appearance.room', room as never);
    },
    [layout, room] as const,
  );
  await putOutside(page, 'Eien/Vault/Ideas.md', 'An idea, and a line of words after it.\n');
  await page.reload();
  await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
  await titles(page).first().click();
  await expect(page.locator('.page .title').first()).toHaveText('Ideas');
}

/** Whether the popover is the phone's sheet: across the screen, its foot on the screen's. */
async function isSheet(page: Page): Promise<boolean> {
  // Once it has risen into place.
  await look(page).evaluate((sheet) =>
    Promise.all(sheet.getAnimations().map((animation) => animation.finished)),
  );
  const box = await look(page).boundingBox();
  const screen = page.viewportSize();
  if (!box || !screen) throw new Error('no popover');
  return Math.abs(box.y + box.height - screen.height) < 1 && box.width >= screen.width - 1;
}

for (const layout of ['band', 'slip', 'runhead'] as const) {
  test(`in ${layout}, the Look control opens the sheet; a change shows at once; Done closes it`, async ({
    page,
  }) => {
    await onPage(page, layout);
    await phoneControl(page).click();
    await expect(look(page)).toBeVisible();
    expect(await isSheet(page)).toBe(true);
    // A finger's size, and nothing of the desktop's breadth: page width needs room round a page.
    const loose = look(page).locator('[data-setting="appearance.leading"] [data-value="loose"]');
    expect((await loose.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(look(page).locator('[data-setting="page.width"]')).toHaveCount(0);
    await loose.click();
    await expect
      .poll(() =>
        page.evaluate(async () => (await window.eien.settings.read())['appearance.leading']),
      )
      .toBe('loose');
    await look(page).locator('[data-setting="appearance.scheme"] [data-value="night"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await look(page).getByRole('button', { name: 'Done' }).click();
    await expect(look(page)).toBeHidden();
  });
}

test('the ⋯’s Look opens it too, and the system’s back closes it, the page still there', async ({
  page,
}) => {
  await onPage(page);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.locator('.menu [role^="menuitem"]', { hasText: /^Look$/ }).click();
  await expect(look(page)).toBeVisible();
  await systemBack(page);
  await expect(look(page)).toBeHidden();
  await expect(page.locator('.page .title').first()).toHaveText('Ideas');
});

test.describe('Wide screen', () => {
  const TABLET = { width: 1180, height: 820 };

  test('Panes is the desktop’s window: the column under the control, always in sight', async ({
    page,
  }) => {
    await page.setViewportSize(TABLET);
    await onPage(page, 'band', 'panes');
    await expect(page.locator('.shell')).toHaveAttribute('data-room', 'panes');
    const control = page.locator('.page__bar [data-command="look"]');
    await control.click();
    await expect(look(page)).toBeVisible();
    expect(await isSheet(page)).toBe(false);
    const [at, under] = [await control.boundingBox(), await look(page).boundingBox()];
    expect(under?.y).toBeGreaterThanOrEqual((at?.y ?? 0) + (at?.height ?? 0));
    await expect(look(page).locator('[data-setting="page.width"]')).toHaveCount(1);
  });

  test('One at a time is the phone’s: the sheet', async ({ page }) => {
    await page.setViewportSize(TABLET);
    await onPage(page, 'band', 'one');
    await expect(page.locator('.shell')).toHaveAttribute('data-room', 'one');
    await phoneControl(page).click();
    await expect(look(page)).toBeVisible();
    expect(await isSheet(page)).toBe(true);
  });
});
