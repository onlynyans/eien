// Settings over the window (spec §6, #18, #24, #25, #31): moved by its head
// and resized by its edges, inside the window, its box kept on this device;
// the breadcrumb; Esc gives the keyboard back; This vault's settings go to
// the vault's file; the machine voice's face and the weight of names show
// in the window; the Running head's strip takes the ground chosen.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { galleryTheme, type Hex, rgbOf } from '../../src/core/themes';
import { ALONE, type Box, boxOf, closeApp, expect, launchApp, test } from './launch';

test.use({
  vaultFiles: {
    'Book/One.md': 'alpha beta\n',
    'Book/Two.md': 'gamma delta\n',
    'Book/.eien-folder.json': JSON.stringify({ order: ['One.md', 'Two.md'], book: {} }),
  },
});

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
const goTo = (page: Page, tab: string) =>
  dialog(page).getByRole('navigation').getByRole('button', { name: tab, exact: true }).click();
const choose = (page: Page, setting: string, name: string) =>
  dialog(page)
    .getByRole('group', { name: setting, exact: true })
    .getByRole('button', { name, exact: true })
    .click();
const crumbs = (page: Page) => dialog(page).locator('.settings__crumbs');
const style = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
const rgb = (hex: Hex) => `rgb(${rgbOf(hex).join(', ')})`;
const PAPER = galleryTheme('paper')?.palette;

/** Drag from the middle of `from` by `dx`, `dy`, with the mouse. */
async function drag(page: Page, from: Box, dx: number, dy: number): Promise<void> {
  const [x, y] = [from.x + from.width / 2, from.y + from.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2);
  await page.mouse.move(x + dx, y + dy);
  await page.mouse.up();
}

const near = (box: Box) => ({
  x: Math.round(box.x),
  y: Math.round(box.y),
  w: Math.round(box.width),
  h: Math.round(box.height),
});

// Dragged with the pointer: alone, so no other test's window takes it mid-drag.
test(
  'moves by its head, resizes by its edges and corners, inside the window, and goes back on a double-click',
  ALONE,
  async ({ app, page, userData, vault }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.getByRole('button', { name: 'Settings' }).click();
    const sheet = dialog(page);
    const first = near(await boxOf(sheet));
    expect(first).toEqual({ x: 112, y: 64, w: 976, h: 672 }); // the inset, 64px and 112px

    // A move never resizes.
    await drag(page, await boxOf(sheet.locator('.settings__crumbs')), -40, 30);
    expect(near(await boxOf(sheet))).toEqual({ ...first, x: 72, y: 94 });

    // Its right edge, then its left, then a corner: only those edges move.
    await drag(page, await boxOf(sheet.locator('[data-grip="e"]')), -100, 0);
    expect(near(await boxOf(sheet))).toEqual({ x: 72, y: 94, w: 876, h: 672 });
    await drag(page, await boxOf(sheet.locator('[data-grip="w"]')), 60, 0);
    expect(near(await boxOf(sheet))).toEqual({ x: 132, y: 94, w: 816, h: 672 });
    await drag(page, await boxOf(sheet.locator('[data-grip="nw"]')), 40, 50);
    expect(near(await boxOf(sheet))).toEqual({ x: 172, y: 144, w: 776, h: 622 });

    // Never smaller than 560 × 380, never out of the window, and still open after a drag let go outside.
    await drag(page, await boxOf(sheet.locator('[data-grip="se"]')), -900, -900);
    expect(near(await boxOf(sheet))).toMatchObject({ w: 560, h: 380 });
    await drag(page, await boxOf(sheet.locator('.settings__crumbs')), 2000, 2000);
    expect(near(await boxOf(sheet))).toEqual({
      x: 1200 - 8 - 560,
      y: 800 - 8 - 380,
      w: 560,
      h: 380,
    });
    await expect(sheet).toBeVisible();

    // The corner takes the keyboard too.
    await sheet.getByRole('button', { name: 'Resize settings' }).focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    expect(near(await boxOf(sheet))).toEqual({ x: 632, y: 412, w: 560, h: 380 }); // at its least: no smaller

    // Kept on this device: it opens where it was left, after a restart too.
    await drag(page, await boxOf(sheet.locator('.settings__crumbs')), -300, -200);
    const kept = near(await boxOf(sheet));
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings' }).click();
    expect(near(await boxOf(sheet))).toEqual(kept);
    await closeApp(app);
    const again = await launchApp(userData, vault);
    try {
      const page2 = await again.firstWindow();
      await page2.setViewportSize({ width: 1200, height: 800 });
      await page2.getByRole('button', { name: 'Settings' }).click();
      expect(near(await boxOf(dialog(page2)))).toEqual(kept);

      // A double-click on its head puts it back.
      await dialog(page2).locator('.settings__crumbs').dblclick();
      expect(near(await boxOf(dialog(page2)))).toEqual(first);
    } finally {
      await closeApp(again);
    }
  },
);

test('its breadcrumb names the tab; Esc closes it and gives the keyboard back', async ({
  page,
}) => {
  const opener = page.locator('[data-key="command:settings"]').first();
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(crumbs(page)).toHaveText('Settings/Look/Appearance');
  // The keyboard starts on the tab shown, and every tab is reached by it.
  const tab = dialog(page).getByRole('button', { name: 'Appearance', exact: true });
  await expect(tab).toBeFocused();
  await expect(tab).toHaveAttribute('aria-current', 'true');
  for (const [name, path] of [
    ['Type', 'Look/Type'],
    ['Custom', 'Themes/Custom'],
    ['Editor', 'Writing/Editor'],
    ['Writing', 'This vault/Writing'],
  ]) {
    const button = dialog(page).getByRole('navigation').getByRole('button', { name, exact: true });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(crumbs(page)).toHaveText(`Settings/${path}`);
    await expect(button).toHaveAttribute('aria-current', 'true');
  }
  // A control in the tab, by the keyboard: past Close, at the head.
  await page.keyboard.press('Tab');
  await expect(dialog(page).getByRole('button', { name: 'Close settings' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('data-value', 'roman');

  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(opener).toBeFocused();
  // It opens again where it was.
  await page.keyboard.press('Enter');
  await expect(crumbs(page)).toHaveText('Settings/This vault/Writing');
});

test('This vault’s settings stand apart, and go to the vault’s own file', async ({
  page,
  userData,
  vault,
}) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await goTo(page, 'Writing');
  await expect(dialog(page).locator('.settings__scope').first()).toContainText('.eien/config.json');
  await choose(page, 'Quotation marks', 'Straight " "');
  await choose(page, 'Scene breaks', 'Rule alone');
  const vaultFile = join(vault ?? '', '.eien', 'config.json');
  await expect
    // Asked before the first write lands, the file isn't there yet: a read that throws ends a poll.
    .poll(() => existsSync(vaultFile) && JSON.parse(readFileSync(vaultFile, 'utf8')))
    .toEqual({ 'typography.quotes': 'straight', 'html.sceneBreak': 'rule' });
  // None of this device's: nothing written to its own file.
  await goTo(page, 'Appearance');
  await choose(page, 'Density', 'Compact');
  const deviceFile = join(userData, 'settings.json');
  await expect
    .poll(() => existsSync(deviceFile) && JSON.parse(readFileSync(deviceFile, 'utf8')).settings)
    .toEqual({ 'appearance.density': 'compact' });
});

test('the interface font, the Source font and the weight of names show in the window', async ({
  page,
}) => {
  await page.locator('.tree-row__label', { hasText: 'Book' }).click();
  await page.locator('.note-row', { hasText: 'One' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await goTo(page, 'Type');

  // The interface in a text face, at that face's own sizes.
  expect(await style(page, '.colophon', 'font-family')).toContain('IBM Plex Mono');
  await choose(page, 'Interface font', 'Literata');
  await expect.poll(() => style(page, '.colophon', 'font-family')).toContain('Literata Variable');
  expect(await style(page, '.label', 'font-size')).toBe('10.5px');
  await choose(page, 'Interface font', 'IBM Plex Mono');
  await expect.poll(() => style(page, '.label', 'font-size')).toBe('10px');

  // The Source font is its own: the Source view's face and size change, the interface's don't.
  const sourceFace = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--eien-face-source'),
    );
  await choose(page, 'Source font', 'Comic Mono');
  await expect.poll(sourceFace).toContain('Comic Mono');
  expect(await style(page, '.colophon', 'font-family')).toContain('IBM Plex Mono');
  await choose(page, 'Source font', 'IBM Plex Mono');
  await expect.poll(sourceFace).toContain('IBM Plex Mono');

  // The weights: the sidebar's names, the list's titles; the chosen title a step heavier, at most 700.
  const weight = (selector: string) => style(page, selector, 'font-weight');
  expect(await weight('.tree-row__label')).toBe('400');
  expect(await weight('.note-row[aria-current="true"] .note-row__title')).toBe('500');
  await choose(page, 'Sidebar names', '600');
  await choose(page, 'List titles', '600');
  await expect.poll(() => weight('.tree-row__label')).toBe('600');
  // The chosen folder's name is no heavier than the rest.
  expect(await weight('.tree-row__name[aria-current="true"] .tree-row__label')).toBe('600');
  expect(await weight('.note-row:not([aria-current="true"]) .note-row__title')).toBe('600');
  expect(await weight('.note-row[aria-current="true"] .note-row__title')).toBe('700');
  await choose(page, 'List titles', '700');
  await expect.poll(() => weight('.note-row[aria-current="true"] .note-row__title')).toBe('700');
  // The Type tab shows them in its own words too.
  await expect(
    dialog(page).locator('[data-setting="appearance.titleWeight"] .weight__sample'),
  ).toHaveCSS('font-weight', '700');
});

test.describe('the Running head layout', () => {
  test.use({ deviceFile: { settings: { 'appearance.layout': 'runhead' } } });

  test('its strip takes the ground chosen, one of the theme’s own surfaces', async ({ page }) => {
    const strip = page.locator('.window-head');
    await expect(strip).toHaveCSS('background-color', rgb(PAPER?.desk[0] ?? '#000000'));
    await page.getByRole('button', { name: 'Settings' }).click();
    await choose(page, 'Running head', 'Paper');
    await expect(strip).toHaveCSS('background-color', rgb(PAPER?.paper[0] ?? '#000000'));
    await choose(page, 'Running head', 'Desk');
    await expect(strip).toHaveCSS('background-color', rgb(PAPER?.desk[0] ?? '#000000'));
  });
});
