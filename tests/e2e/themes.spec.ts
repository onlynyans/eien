// Themes on the real app (spec §7): Settings / Themes, Gallery and Custom;
// choosing one repaints the window, survives a restart, and a theme's file
// changed on another device shows at once. A custom theme is made, worn,
// mixed, renamed and sent to the trash, its file following on disk.

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import {
  FIRST_MIX,
  galleryTheme,
  type Hex,
  type Mix,
  mixPalette,
  rgbOf,
} from '../../src/core/themes';
import { closeApp, expect, fakeTrash, launchApp, test } from './launch';

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
const goTo = (page: Page, tab: string) =>
  dialog(page).getByRole('navigation').getByRole('button', { name: tab, exact: true }).click();
/** A theme's card in the tab shown. */
const card = (page: Page, name: string) =>
  dialog(page).locator('.themes__cards').getByRole('button', { name, exact: true });
const choose = (page: Page, name: string) => card(page, name).click();
const themesIn = (vault: string | null) => readdirSync(join(vault ?? '', '.eien', 'themes'));
const readTheme = (vault: string | null, title: string) =>
  JSON.parse(readFileSync(join(vault ?? '', '.eien', 'themes', `${title}.json`), 'utf8'));
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
  await goTo(page, 'Gallery');
  await expect(dialog(page).locator('.settings__crumbs')).toHaveText('Settings/Themes/Gallery');

  await choose(page, 'Kinari');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'kinari');
  await expect(desk(page)).toHaveCSS(
    'background-color',
    rgb(galleryTheme('kinari')?.palette.desk[0] ?? '#000000'),
  );

  await expect(card(page, 'Kinari')).toHaveAttribute('aria-pressed', 'true');
  await goTo(page, 'Custom');
  await choose(page, 'Late Train'); // the vault's own
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'mine');
  await expect(desk(page)).toHaveCSS('background-color', rgb(mixPalette(LATE).desk[0]));
  await expect(card(page, 'Late Train')).toHaveAttribute('aria-pressed', 'true');
  await goTo(page, 'Gallery');
  await expect(card(page, 'Kinari')).toHaveAttribute('aria-pressed', 'false');
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
  await goTo(page, 'Custom');
  await choose(page, 'Late Train');
  await expect(desk(page)).toHaveCSS('background-color', rgb(mixPalette(LATE).desk[0]));

  const file = join(vault ?? '', '.eien', 'themes', 'Late Train.json');
  writeFileSync(file, themeFile(ORCHARD));
  await expect(desk(page)).toHaveCSS('background-color', rgb(mixPalette(ORCHARD).desk[0]));

  // Another device's new theme joins the Custom tab, and its mix shows in the one open.
  await expect(dialog(page).locator('[data-knob="paper"]')).toHaveValue(String(ORCHARD.paper));
  writeFileSync(join(vault ?? '', '.eien', 'themes', 'Orchard.json'), themeFile(ORCHARD));
  await expect(card(page, 'Orchard')).toBeVisible();

  writeFileSync(file, '{ "mix": '); // half-written by hand: worn as Washi meanwhile
  await expect(page.locator('html')).not.toHaveAttribute('data-palette');
  await expect(desk(page)).toHaveCSS(
    'background-color',
    rgb(galleryTheme('washi')?.palette.desk[0] ?? '#000000'),
  );
});

test('a custom theme made, worn, mixed, renamed and sent to the trash, its file following', async ({
  app,
  page,
  vault,
}) => {
  const trash = await fakeTrash(app);
  try {
    await page.getByRole('button', { name: 'Settings' }).click();
    await goTo(page, 'Custom');
    await dialog(page).getByRole('button', { name: 'New theme' }).click();

    // Made: a file of its own, worn at once, its name ready to be typed over.
    const name = dialog(page).getByRole('textbox', { name: 'Theme name' });
    await expect(name).toBeFocused();
    await expect(name).toHaveValue('Untitled');
    expect(readTheme(vault, 'Untitled')).toEqual({ name: 'Untitled', mix: FIRST_MIX });
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'mine');
    await expect(desk(page)).toHaveCSS('background-color', rgb(mixPalette(FIRST_MIX).desk[0]));
    await expect(card(page, 'Untitled')).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog(page).locator('.mix__file')).toHaveText('.eien/themes/Untitled.json');

    // Mixed with the keyboard: worn as it turns, written when it rests, still keeping the contrast.
    const paper = dialog(page).locator('[data-knob="paper"]');
    await paper.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    const mixed = { ...FIRST_MIX, paper: FIRST_MIX.paper + 10 };
    await expect(desk(page)).toHaveCSS('background-color', rgb(mixPalette(mixed).desk[0]));
    await expect.poll(() => readTheme(vault, 'Untitled').mix).toEqual(mixed);
    // The seal is the theme's own: one colour per theme.
    const seal = dialog(page).locator('[data-knob="seal"]');
    await seal.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
    const sealed = { ...mixed, seal: mixed.seal - 5 };
    await expect(page.locator('.sidebar .seal').first()).toHaveCSS(
      'background-color',
      rgb(mixPalette(sealed).seal[0]),
    );
    await expect.poll(() => readTheme(vault, 'Untitled').mix).toEqual(sealed);
    await expect(dialog(page).locator('.mix__verdict')).toHaveText(
      'Every ink keeps Eien’s contrast, by day and by night.',
    );

    // Renamed in place: the file is renamed, the worn theme follows it; a taken name is refused.
    await name.fill('Late Train');
    await name.press('Enter');
    await expect(dialog(page).locator('.mix__said')).toHaveText(
      '“Late Train” is a theme already: this one keeps its name.',
    );
    await expect(name).toHaveValue('Untitled');
    await name.fill('Harbour at Dusk');
    await name.press('Enter');
    await expect(dialog(page).locator('.mix__file')).toHaveText(
      '.eien/themes/Harbour at Dusk.json',
    );
    await expect
      .poll(() => themesIn(vault).sort())
      .toEqual(['Harbour at Dusk.json', 'Late Train.json']);
    expect(readTheme(vault, 'Harbour at Dusk')).toEqual({ name: 'Harbour at Dusk', mix: sealed });
    await expect(card(page, 'Harbour at Dusk')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'mine');

    // Esc in the name puts it back, and leaves Settings open.
    await name.fill('Something else');
    await name.press('Escape');
    await expect(name).toHaveValue('Harbour at Dusk');
    await expect(dialog(page)).toBeVisible();

    // To the trash: the file goes where it can be taken back, and Washi is worn.
    await dialog(page).getByRole('button', { name: 'Send Harbour at Dusk to the trash' }).click();
    await expect(dialog(page).locator('.mix__said')).toHaveText(
      '“Harbour at Dusk” is in the trash, where you can take it back.',
    );
    await expect.poll(() => readdirSync(trash)).toEqual(['Harbour at Dusk.json']);
    expect(themesIn(vault)).toEqual(['Late Train.json']);
    await expect(page.locator('html')).not.toHaveAttribute('data-palette');
    await expect(card(page, 'Harbour at Dusk')).toHaveCount(0);
    await expect(dialog(page).locator('.mix')).toHaveCount(0);
  } finally {
    rmSync(trash, { recursive: true, force: true });
  }
});

test('a file in .eien/themes that isn’t a theme is listed, worn as Washi, never written', async ({
  page,
  vault,
}) => {
  const file = join(vault ?? '', '.eien', 'themes', 'Broken.json');
  writeFileSync(file, '{ "mix": ');
  await page.getByRole('button', { name: 'Settings' }).click();
  await goTo(page, 'Custom');
  await choose(page, 'Broken');
  await expect(dialog(page).locator('.mix__unread')).toContainText(
    'Eien can’t read this theme file',
  );
  await expect(dialog(page).locator('.mix__body')).toBeHidden(); // no knobs to turn
  await expect(page.locator('html')).not.toHaveAttribute('data-palette');
  expect(existsSync(file) && readFileSync(file, 'utf8')).toBe('{ "mix": ');
});
