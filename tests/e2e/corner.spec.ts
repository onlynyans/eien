// The window's top-left corner with the sidebar shut (spec §4; docs/design/explorations/corner.md).
// In Band and Slip, Shut sidebar chooses: the seal alone, staying where it was in the top row,
// or a strip of desk as wide as the bands are tall, which on macOS widens at its top into a
// shoulder holding the traffic lights, its seal a band lower. In Running head a shut sidebar is
// always its strip. Full screen has no lights: the seal is in the top row, with no shoulder.

import type { ElectronApplication, Page } from '@playwright/test';
import { type Box, boxOf, clickMenu, expect, freeArea, test } from './launch';

test.use({ vaultFiles: { 'Note.md': 'Words.\n', 'Other.md': 'More words.\n' } });

const MAC = process.platform === 'darwin';
type Layout = 'band' | 'slip' | 'runhead';

const shownSeal = (page: Page) => page.locator('.sidebar__strip .seal-button');
const sidebarWidth = async (page: Page) => (await boxOf(page.locator('.sidebar'))).width;
/** The panes' top band's height: the list's search band. */
const bandOf = async (page: Page) => (await boxOf(page.locator('.list__search'))).height;
/** Where the list's band lets its search field start. */
const fieldLeft = async (page: Page) => (await boxOf(page.locator('.list__search .field'))).x;

/** The shoulder (the strip's ::before), as the window lays it out; null when there's none. */
const shoulder = (page: Page) =>
  page.locator('.sidebar__strip').evaluate((strip) => {
    const style = getComputedStyle(strip, '::before');
    if (style.content === 'none') return null;
    const left = Number.parseFloat(style.left);
    return {
      right: left + Number.parseFloat(style.width),
      height: Number.parseFloat(style.height),
      region: style.getPropertyValue('-webkit-app-region'),
    };
  });

/** Shut the sidebar with its seal, as the writer does, once the window is drawn. */
async function shut(page: Page): Promise<Box> {
  const open = await boxOf(page.locator('.sidebar__head .seal-button'));
  await page.locator('.sidebar__head .seal-button').click();
  await expect(page.locator('.shell')).toHaveAttribute('data-sidebar-shut', '');
  await expect(shownSeal(page)).toBeVisible();
  return open;
}

/** Into full screen or out of it, once the window knows: no lights in full screen. */
async function fullScreen(app: ElectronApplication, page: Page, on: boolean): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, on) => BrowserWindow.getAllWindows()[0]?.setFullScreen(on),
    on,
  );
  if (on) await expect(page.locator('html')).not.toHaveAttribute('data-controls-left');
  else await expect(page.locator('html')).toHaveAttribute('data-controls-left');
}

for (const layout of ['band', 'slip'] as const) {
  test.describe(`${layout}, the seal alone (the default)`, () => {
    test.use({ deviceFile: { settings: { 'appearance.layout': layout } } });

    test('shut, the seal stays where it was, and the list’s band starts past it', async ({
      page,
    }) => {
      await expect(page.locator('html')).toHaveAttribute('data-shut-sidebar', 'seal');
      const open = await shut(page);
      await expect.poll(() => sidebarWidth(page)).toBe(0);
      const seal = await boxOf(shownSeal(page));
      expect(seal.x).toBeCloseTo(open.x, 0);
      expect(seal.y).toBeCloseTo(open.y, 0);
      expect(seal.y + seal.height).toBeLessThanOrEqual(await bandOf(page)); // the top row
      expect(await fieldLeft(page)).toBeGreaterThan(seal.x + seal.width);
      if (MAC) expect(seal.x).toBeGreaterThan((await freeArea(page)).left); // past the lights
      // The seal is the way back: no › beside it.
      await expect(page.locator('.chevron-slot--sidebar')).toBeHidden();
      await shownSeal(page).click();
      await expect(page.locator('.shell')).not.toHaveAttribute('data-sidebar-shut', '');
      await expect(page.locator('.sidebar__head .seal-button')).toBeVisible();
    });
  });

  test.describe(`${layout}, a strip of desk`, () => {
    test.use({
      deviceFile: { settings: { 'appearance.layout': layout, 'appearance.shutSidebar': 'strip' } },
    });

    test('shut, the strip is as wide as the bands are tall, clear of the lights', async ({
      page,
    }) => {
      await shut(page);
      const band = await bandOf(page);
      await expect.poll(() => sidebarWidth(page)).toBe(band);
      const seal = await boxOf(shownSeal(page));
      const strip = await shoulder(page);
      if (MAC) {
        // The lights stand wider than the strip: a shoulder of desk holds them, one band tall,
        // and the seal waits under them; the list's band starts past the shoulder.
        expect(strip).not.toBeNull();
        expect(strip?.height).toBe(band);
        expect(strip?.region).toBe('drag'); // it takes the bands' place: it drags the window
        expect(strip?.right).toBeGreaterThan((await freeArea(page)).left);
        expect(await fieldLeft(page)).toBeGreaterThan(strip?.right ?? 0);
        expect(seal.y).toBeGreaterThanOrEqual(band);
      } else {
        // The controls are at the right: no shoulder, and the seal is at the strip's top.
        expect(strip).toBeNull();
        expect(seal.y + seal.height).toBeLessThanOrEqual(band);
      }
      // In the strip's middle: its desk, less the hairline at its edge.
      expect(Math.abs(seal.x + seal.width / 2 - band / 2)).toBeLessThanOrEqual(1);
      // The way back: the seal, or the › the layout sets beside it.
      await page.locator('.sidebar__strip').hover();
      await page.locator('.chevron-slot--sidebar button').click();
      await expect(page.locator('.shell')).not.toHaveAttribute('data-sidebar-shut', '');
    });
  });

  test.describe(`${layout} in full screen`, () => {
    test.use({ deviceFile: { settings: { 'appearance.layout': layout } } });

    test('with no lights, either way the seal is in the top row, with no shoulder', async ({
      app,
      page,
    }) => {
      test.skip(!MAC, 'macOS’s full screen takes the lights away');
      await shut(page);
      await fullScreen(app, page, true);
      const band = await bandOf(page);
      for (const way of ['seal', 'strip'] as const) {
        await chooseShutSidebar(app, page, way);
        await expect.poll(() => sidebarWidth(page)).toBe(way === 'seal' ? 0 : band);
        const seal = await boxOf(shownSeal(page));
        expect(seal.y + seal.height, way).toBeLessThanOrEqual(band);
        expect(await shoulder(page), way).toBeNull();
        expect(await fieldLeft(page), way).toBeGreaterThan(seal.x + seal.width);
      }
      // A window again: the lights are back, and the seal waits under them.
      await fullScreen(app, page, false);
      await expect.poll(async () => (await boxOf(shownSeal(page))).y).toBeGreaterThanOrEqual(band);
      expect(await shoulder(page)).not.toBeNull();
    });
  });
}

/** Choose Shut sidebar in Settings, from the menu (the sidebar's foot is shut), and close it. */
async function chooseShutSidebar(
  app: ElectronApplication,
  page: Page,
  way: 'seal' | 'strip',
): Promise<void> {
  await clickMenu(app, MAC ? 'Eien' : 'File', 'Settings…');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog
    .getByRole('group', { name: 'Shut sidebar' })
    .locator(`[data-value="${way}"]`)
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-shut-sidebar', way);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

test.describe('Shut sidebar, changed while the sidebar is shut', () => {
  test.use({ deviceFile: { settings: { 'appearance.layout': 'band' } } });

  test('fits the strip at once, and back', async ({ app, page }) => {
    await shut(page);
    await expect.poll(() => sidebarWidth(page)).toBe(0);
    await chooseShutSidebar(app, page, 'strip');
    await expect.poll(() => sidebarWidth(page)).toBe(await bandOf(page));
    await chooseShutSidebar(app, page, 'seal');
    await expect.poll(() => sidebarWidth(page)).toBe(0);
  });
});

test.describe('running head', () => {
  const layout: Layout = 'runhead';
  // Shut sidebar is Band's and Slip's: here, its seal alone changes nothing.
  test.use({
    deviceFile: { settings: { 'appearance.layout': layout, 'appearance.shutSidebar': 'seal' } },
  });

  test('a shut sidebar is always its strip, the seal at its top, under the running head', async ({
    page,
  }) => {
    await expect(page.locator('html')).not.toHaveAttribute('data-shut-sidebar', /.*/);
    await shut(page);
    // The strip is as wide as Running head's panes' heads are tall.
    const head = await boxOf(page.locator('.window-head'));
    const band = (await boxOf(page.locator('.list__search'))).height;
    await expect.poll(() => sidebarWidth(page)).toBe(band);
    const seal = await boxOf(shownSeal(page));
    expect(seal.y).toBeGreaterThanOrEqual(head.y + head.height);
    expect(seal.y + seal.height).toBeLessThanOrEqual(head.y + head.height + band);
    expect(await shoulder(page)).toBeNull();
  });
});
