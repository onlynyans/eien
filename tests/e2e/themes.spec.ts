// Themes on the real app (spec §7): the gallery's and the writer's own, in
// the Palette; choosing one repaints the window, survives a restart, and a
// theme's file changed on another device shows at once.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { galleryTheme, type Hex, type Mix, mixPalette, rgbOf } from '../../src/core/themes';
import { closeApp, expect, launchApp, test } from './launch';

const LATE: Mix = { paper: 215, warmth: 10, ink: 225, seal: 8 };
const ORCHARD: Mix = { paper: 42, warmth: 30, ink: 120, seal: 20 };
const themeFile = (mix: Mix) => JSON.stringify({ name: 'Late Train', mix });

test.use({
  vaultFiles: {
    'Ideas.md': 'A note.\n',
    '.eien/themes/Late Train.json': themeFile(LATE),
  },
});

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
const choose = (page: Page, name: string) =>
  dialog(page).getByRole('button', { name, exact: true }).click();
const rgb = (hex: Hex) => `rgb(${rgbOf(hex).join(', ')})`;
/** The sidebar is the desk: by day, as the tests' systems are. */
const desk = (page: Page) => page.locator('.sidebar');

test('choosing a theme repaints the window, and it’s worn again after a restart', async ({
  app,
  page,
  userData,
  vault,
}) => {
  await page.getByRole('button', { name: 'Settings' }).click();

  await choose(page, 'Kinari');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'kinari');
  await expect(desk(page)).toHaveCSS(
    'background-color',
    rgb(galleryTheme('kinari')?.palette.desk[0] ?? '#000000'),
  );

  await choose(page, 'Late Train'); // the vault's own, after the gallery's
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'mine');
  await expect(desk(page)).toHaveCSS('background-color', rgb(mixPalette(LATE).desk[0]));
  await expect(dialog(page).getByRole('button', { name: 'Late Train' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const deviceFile = join(userData, 'settings.json');
  await expect
    .poll(() => JSON.parse(readFileSync(deviceFile, 'utf8')).settings)
    .toEqual({ 'appearance.palette': 'mine:Late Train' });
  await closeApp(app);

  const again = await launchApp(userData, vault);
  try {
    const page2 = await again.firstWindow();
    await expect(page2.locator('html')).toHaveAttribute('data-palette', 'mine');
    await expect(desk(page2)).toHaveCSS('background-color', rgb(mixPalette(LATE).desk[0]));
  } finally {
    await closeApp(again);
  }
});

test('a theme changed on another device shows at once; one taken away leaves Washi', async ({
  page,
  vault,
}) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await choose(page, 'Late Train');
  await expect(desk(page)).toHaveCSS('background-color', rgb(mixPalette(LATE).desk[0]));

  const file = join(vault ?? '', '.eien', 'themes', 'Late Train.json');
  writeFileSync(file, themeFile(ORCHARD));
  await expect(desk(page)).toHaveCSS('background-color', rgb(mixPalette(ORCHARD).desk[0]));

  // Another device's new theme joins the Palette.
  writeFileSync(join(vault ?? '', '.eien', 'themes', 'Orchard.json'), themeFile(ORCHARD));
  await expect(dialog(page).getByRole('button', { name: 'Orchard', exact: true })).toBeVisible();

  writeFileSync(file, '{ "mix": '); // half-written by hand: worn as Washi meanwhile
  await expect(page.locator('html')).not.toHaveAttribute('data-palette');
  await expect(desk(page)).toHaveCSS(
    'background-color',
    rgb(galleryTheme('washi')?.palette.desk[0] ?? '#000000'),
  );
});
