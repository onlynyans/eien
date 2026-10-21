// Each layout's phone bottom (docs/design/explorations/overall.md, the phone
// view): A's page tools in the top bar, B's on a slip floating over the page,
// C's in a rail at its foot. Each has Focus mode (#30) and the ⋯ that reaches
// the rest; the desktop's page controls give way to them.

import { devices, expect, type Page, test } from '@playwright/test';
import { open, putOutside, titles } from './outside';

test.use({ ...devices['Pixel 7'] });

const control = (page: Page, command: string) =>
  page.locator(
    `.phone-bar__controls [data-command="${command}"], .page__phone [data-command="${command}"]`,
  );

async function onPage(page: Page): Promise<void> {
  await open(page);
  await putOutside(page, 'Eien/Vault/Ideas.md', 'An idea.\n');
  await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
  await titles(page).first().click();
  await expect(page.locator('.title')).toHaveText('Ideas');
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

const BOTTOMS = {
  band: {
    host: '.phone-bar__controls .host--phone-band',
    commands: ['view.next', 'focus', 'more'],
  },
  slip: {
    host: '.page__phone .host--phone-slip',
    commands: ['view.live', 'view.source', 'view.reading', 'focus', 'more'],
  },
  runhead: {
    host: '.page__phone .host--phone-rail',
    commands: ['view.live', 'view.source', 'view.reading', 'focus', 'seal', 'more'],
  },
} as const;

for (const layout of ['slip', 'runhead', 'band'] as const) {
  test(`the ${layout} layout’s phone bottom: its tools, a finger’s size, only on the page`, async ({
    page,
  }) => {
    await onPage(page);
    if (layout !== 'band') await chooseLayout(page, layout);
    const bottom = BOTTOMS[layout];
    await expect(page.locator(bottom.host)).toBeVisible();
    for (const command of bottom.commands) {
      await expect(control(page, command)).toBeVisible();
      const box = await control(page, command).boundingBox();
      expect(box?.height, command).toBeGreaterThanOrEqual(40);
    }
    // The desktop's page controls aren't drawn on a phone.
    await expect(page.locator('.page__bar')).toBeHidden();
    await expect(page.locator('.window-head')).toBeHidden();
    await expect(page.locator('.chevron-slot--sidebar')).toBeHidden();
    // Focus mode from the bottom, as the menu's View → Focus Mode does.
    await control(page, 'focus').click();
    await expect(control(page, 'focus')).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(() => page.evaluate(async () => (await window.eien.settings.read())['editor.focus']))
      .toBe('on');
    // Back to the notes: the page's tools go with the page.
    await page.locator('.phone-bar__back').click();
    await expect(page.locator(bottom.host)).toBeHidden();
  });
}

test('A’s view control goes Live, Source, Reading and round, as ⌘E does', async ({ page }) => {
  await onPage(page);
  const view = control(page, 'view.next');
  await expect(view.locator('svg')).toHaveAttribute('data-icon', 'live');
  for (const next of ['source', 'reading', 'live']) {
    await view.click();
    await expect(view.locator('svg')).toHaveAttribute('data-icon', next);
  }
});
