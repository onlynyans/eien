// The quick look (backlog #49, docs/quick-look.md): the Look control, the
// page's last tool in each layout, opens a popover of the look's everyday
// settings under it, by a click, by ⇧⌘L (View → Look…'s key) and from the
// menu. A change shows on the page at once; Esc gives the keyboard back.

import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, editorContent, expect, test } from './launch';

test.use({ vaultFiles: { 'Note.md': 'Words on the page.\n\nAnd a second line of them.\n' } });

/** The desktop's Look control (the phone's bars are hidden here). */
const control = (page: Page) =>
  page.locator('[data-command="look"]:not(.phone-bar__controls *, .page__phone *)');
const popover = (page: Page) => page.getByRole('dialog', { name: 'Look: Notes' });

async function ready(page: Page): Promise<void> {
  await page.locator('.note-row', { hasText: 'Note' }).click();
  await expect(page.locator('.title')).toHaveText('Note');
}

const lineHeight = (page: Page) =>
  page
    .locator('.cm-scroller')
    .first()
    .evaluate((scroller) => Number.parseFloat(getComputedStyle(scroller).lineHeight));
const sheetWidth = (page: Page) =>
  page
    .locator('.sheet')
    .first()
    .evaluate((sheet) => sheet.getBoundingClientRect().width);

for (const layout of ['band', 'slip', 'runhead'] as const) {
  test.describe(layout, () => {
    test.use({ deviceFile: { settings: { 'appearance.layout': layout } } });

    test('opens under the control by a click, the keyboard in it; Esc gives it back to the control', async ({
      page,
    }) => {
      await ready(page);
      await control(page).click();
      await expect(popover(page)).toBeVisible();
      await expect(control(page)).toHaveAttribute('aria-expanded', 'true');
      // Its head names whose look, and the keyboard is on the first setting's chosen value.
      await expect(popover(page).locator('.quick-look__crumb')).toHaveText('Look/Notes');
      await expect(
        popover(page).locator('[data-setting="appearance.scheme"] [aria-pressed="true"]'),
      ).toBeFocused();
      // Under the control, its end lined up with the control's.
      const [at, under] = await Promise.all([
        control(page).boundingBox(),
        popover(page).boundingBox(),
      ]);
      expect(under && at && under.y).toBeGreaterThanOrEqual((at?.y ?? 0) + (at?.height ?? 0));
      expect(
        Math.abs((under?.x ?? 0) + (under?.width ?? 0) - (at?.x ?? 0) - (at?.width ?? 0)),
      ).toBeLessThan(2);
      await page.keyboard.press('Escape');
      await expect(popover(page)).toBeHidden();
      await expect(control(page)).toBeFocused();
      await expect(control(page)).toHaveAttribute('aria-expanded', 'false');
    });

    test('opens from View → Look… for the page, with ⇧⌘L, and closes from it again', async ({
      app,
      page,
    }) => {
      await ready(page);
      const key = await lookKey(app);
      expect(key).toBe('CmdOrCtrl+Shift+L');
      await editorContent(page).click();
      await clickMenu(app, 'View', 'Look…');
      await expect(popover(page)).toBeVisible();
      await clickMenu(app, 'View', 'Look…'); // the key again
      await expect(popover(page)).toBeHidden();
      // Opened from the page, the keyboard goes back to the page.
      await expect(editorContent(page)).toBeFocused();
    });

    test('shows each change on the page at once, and stays open', async ({ page }) => {
      await ready(page);
      const [lead, width] = [await lineHeight(page), await sheetWidth(page)];
      await control(page).click();
      await popover(page)
        .locator('[data-setting="appearance.leading"] [data-value="loose"]')
        .click();
      await expect.poll(() => lineHeight(page)).toBeCloseTo(lead * 1.12, 0);
      await popover(page).locator('[data-setting="page.width"] [data-value="narrow"]').click();
      await expect.poll(() => sheetWidth(page)).toBeLessThan(width - 20);
      await popover(page)
        .locator('[data-setting="appearance.scheme"] [data-value="night"]')
        .click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await popover(page).locator('[data-setting="appearance.frame"] [data-value="full"]').click();
      await expect(page.locator('html')).toHaveAttribute('data-frame', 'full');
      await expect(popover(page)).toBeVisible();
      // Settings shows the same values: the popover is Settings' own rows.
      await popover(page)
        .getByRole('button', { name: /All settings/ })
        .click();
      const settings = page.getByRole('dialog', { name: 'Settings' });
      await expect(settings).toBeVisible();
      await expect(popover(page)).toBeHidden();
      await expect(settings.locator('.settings__crumbs')).toHaveText('Settings/Look/Appearance');
      await settings.getByRole('button', { name: 'Type' }).click();
      await expect(
        settings.locator('[data-setting="appearance.leading"] [data-value="loose"]'),
      ).toHaveAttribute('aria-pressed', 'true');
    });
  });
}

/** View → Look…'s key, as the menu bar holds it. */
const lookKey = (app: ElectronApplication) =>
  app.evaluate(
    ({ Menu }) =>
      Menu.getApplicationMenu()
        ?.items.find((item) => item.label === 'View')
        ?.submenu?.items.find((item) => item.label === 'Look…')?.accelerator ?? null,
  );

test.describe('folded', () => {
  test.use({ deviceFile: { settings: { 'appearance.layout': 'band' } } });

  test('opens from the ⋯ it folded behind, under the ⋯', async ({ app, page }) => {
    await ready(page);
    // A narrow window, the system's controls wide over the band's end (toolbar-fold.spec.ts).
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.setContentSize(900, 760),
    );
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(900);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-controls-left');
      document.documentElement.style.setProperty('--controls-w', '300px');
    });
    await expect(control(page)).toBeHidden();
    const more = page.locator('.page__bar').getByRole('button', { name: 'More tools' });
    await more.click();
    await page.locator('.menu').getByRole('menuitem', { name: 'Look' }).click();
    await expect(popover(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(more).toBeFocused();
  });
});
