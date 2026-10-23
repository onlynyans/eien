// No title bar (spec §4): the panes take its space, their top bands drag the
// window, and the system's own controls sit over the bands, clear of
// everything in them: macOS's traffic lights at the sidebar's head, Windows'
// and Linux's minimize, maximize and close over the page's band, in its colours.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, expect, freeArea, test, windowZoom } from './launch';

test.use({ vaultFiles: { 'Note.md': 'Words.\n' } });

const MAC = process.platform === 'darwin';
const BANDS = ['.sidebar__head', '.list__search', '.list__head', '.page__bar'];

const box = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        paddingLeft: Number.parseFloat(style.paddingLeft),
        paddingRight: Number.parseFloat(style.paddingRight),
      };
    });

/** Record what the window's controls are told: the overlay's paint, or where the lights go. */
const recordControls = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) throw new Error('No window');
    const told: unknown[] = [];
    (globalThis as { told?: unknown[] }).told = told;
    window.setTitleBarOverlay = (options) => void told.push(options);
    window.setWindowButtonPosition = (position) => void told.push(position);
  });
const lastTold = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as { told?: unknown[] }).told?.at(-1));

/** The page's band and the ink it's drawn in, as Chromium computes them. */
const bandColours = (page: Page) =>
  page.locator('.page__bar').evaluate((bar) => {
    const ink = document.createElement('span');
    ink.style.color = 'var(--eien-ink-soft)';
    bar.append(ink);
    const colours = {
      band: getComputedStyle(bar).backgroundColor,
      ink: getComputedStyle(ink).color,
    };
    ink.remove();
    return colours;
  });

test('the window has no title bar: the system’s controls sit over the bands', async ({ page }) => {
  await expect(page.locator('.page__bar')).toBeVisible();
  const free = await freeArea(page);
  expect(free.visible).toBe(true);
  if (MAC) {
    // The traffic lights at the left, the sidebar's head starting after them.
    expect(free.left).toBeGreaterThan(40);
    const head = await box(page, '.sidebar__head');
    expect(head.left + head.paddingLeft).toBeGreaterThan(free.left);
    const seal = await page.locator('.sidebar__head .seal-button').boundingBox();
    expect(seal?.x).toBeGreaterThan(free.left);
  } else {
    // Minimize, maximize and close at the right, the page's bar keeping clear of them.
    expect(free.right).toBeGreaterThan(40);
    const bar = await box(page, '.page__bar');
    expect(bar.paddingRight).toBeGreaterThanOrEqual(free.right);
  }
});

test('the panes’ top bands drag the window; every control in them stays clickable', async ({
  page,
}) => {
  await expect(page.locator('.page__bar')).toBeVisible();
  const regions = await page.evaluate((bands) => {
    const region = (element: Element) =>
      getComputedStyle(element).getPropertyValue('-webkit-app-region');
    const controls = bands.flatMap((band) =>
      [
        ...document.querySelectorAll(`${band} :is(button, input, select, textarea, a, [tabindex])`),
      ].map((control) => `${band} ${control.tagName}.${control.className}: ${region(control)}`),
    );
    return {
      bands: bands.map((band) => region(document.querySelector(band) as Element)),
      dragging: controls.filter((line) => !line.endsWith('no-drag')),
      controls: controls.length,
      edges: [...document.querySelectorAll('.pane-edge')].map(region),
    };
  }, BANDS);
  expect(regions.bands).toEqual(['drag', 'drag', 'drag', 'drag']);
  expect(regions.controls).toBeGreaterThan(5);
  expect(regions.dragging).toEqual([]);
  expect(regions.edges).toEqual(['no-drag', 'no-drag']);
});

test('the controls take the band’s colours, by day and by night', async ({ app, page }) => {
  test.skip(MAC, 'macOS’s traffic lights take no colour');
  await expect(page.locator('.page__bar')).toBeVisible();
  await recordControls(app);
  // Day or night, at the sidebar's foot: once each way.
  const scheme = page.locator('.sidebar__foot').getByRole('button', { name: 'Night' });
  for (let turn = 0; turn < 2; turn++) {
    await scheme.click();
    const { band, ink } = await bandColours(page);
    await expect.poll(() => lastTold(app)).toEqual({ color: band, symbolColor: ink, height: 56 });
  }
});

test.describe('zoom', () => {
  test.use({ deviceFile: { settings: { 'window.zoom': 120 } } });

  test('⌘+ and ⌘− zoom every pane outside the page, and the page alone inside it', async ({
    app,
    page,
  }) => {
    await expect(page.locator('.page__bar')).toBeVisible();
    expect(await windowZoom(app)).toBeCloseTo(1.2); // this device's, from the first draw
    await recordControls(app);

    // The keyboard in the list: the whole window.
    await page.locator('.note-row', { hasText: 'Note' }).click();
    await page.locator('.note-row', { hasText: 'Note' }).focus();
    await clickMenu(app, 'View', 'Zoom In');
    await expect.poll(() => windowZoom(app)).toBeCloseTo(1.3);
    await expect(page.locator('.sheet')).toHaveCSS('zoom', '1');
    await expect(page.locator('.colophon__zoom')).toBeHidden();
    // The controls' band grows with it, and the lights stay in its middle.
    const band = Math.round(56 * 1.3);
    await expect
      .poll(() => lastTold(app))
      .toMatchObject(MAC ? { y: Math.round((band - 16) / 2) } : { height: band });

    // The keyboard in the page: the page alone, as before.
    await page.locator('.cm-content').click();
    await clickMenu(app, 'View', 'Zoom In');
    await expect(page.locator('.sheet')).toHaveCSS('zoom', '1.1');
    await expect(page.locator('.colophon__zoom')).toHaveText('110%');
    expect(await windowZoom(app)).toBeCloseTo(1.3);

    // ⌘0 puts back whichever ⌘+ would change: here the page's.
    await clickMenu(app, 'View', 'Actual Size');
    await expect(page.locator('.sheet')).toHaveCSS('zoom', '1');
    expect(await windowZoom(app)).toBeCloseTo(1.3);
    // And outside the page, the window's.
    await page.locator('.note-row', { hasText: 'Note' }).focus();
    await clickMenu(app, 'View', 'Actual Size');
    await expect.poll(() => windowZoom(app)).toBe(1);
  });

  test('the whole window’s zoom goes no further than 50% to 200%, and is kept', async ({
    app,
    page,
    userData,
  }) => {
    await expect(page.locator('.page__bar')).toBeVisible();
    await page.locator('.note-row', { hasText: 'Note' }).focus();
    for (let i = 0; i < 12; i++) await clickMenu(app, 'View', 'Zoom In');
    await expect.poll(() => windowZoom(app)).toBe(2);
    for (let i = 0; i < 18; i++) await clickMenu(app, 'View', 'Zoom Out');
    await expect.poll(() => windowZoom(app)).toBe(0.5);
    await expect
      .poll(() => JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8')).settings)
      .toMatchObject({ 'window.zoom': 50 });
  });
});
