// Phase 5 on the real app: the settings screen, the look it sets, where
// each setting is kept, and what happens when a settings file is wrong
// (spec §6–§7).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import {
  clickMenu,
  closeApp,
  editorContent,
  editorLines,
  expect,
  launchApp,
  test,
  windowZoom,
} from './launch';

const BOOK = {
  'Book/One.md': 'alpha beta gamma delta\n',
  // Letters from every subset the faces are cut into, so each one loads.
  'Book/Two.md': 'The second chapter. Привет, ѣ ҕ. Ελληνικά. Tiếng Việt. Őrült kő. ₴\n',
  'Book/.eien-folder.json': JSON.stringify({ order: ['One.md', 'Two.md'], book: {} }),
};
test.use({ vaultFiles: BOOK });

const FACES = {
  Newsreader: 'Newsreader Variable',
  Literata: 'Literata Variable',
  'IBM Plex Sans': 'IBM Plex Sans Variable',
  'Source Sans 3': 'Source Sans 3 Variable',
  'Atkinson Hyperlegible Next': 'Atkinson Hyperlegible Next Variable',
  'Schibsted Grotesk': 'Schibsted Grotesk Variable',
  'Hanken Grotesk': 'Hanken Grotesk Variable',
  'Instrument Sans': 'Instrument Sans Variable',
};

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
/** Go to a tab of Settings, by its name in the side column. */
const goTo = (page: Page, tab: string) =>
  dialog(page).getByRole('navigation').getByRole('button', { name: tab, exact: true }).click();
/** In the tab shown, choose `name` for the setting labelled `setting`. */
const control = (page: Page, setting: string, name: string) =>
  dialog(page)
    .getByRole('group', { name: setting, exact: true })
    .getByRole('button', { name, exact: true });
const choose = (page: Page, setting: string, name: string) => control(page, setting, name).click();
const root = (page: Page) => page.locator('html');
const style = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
const settingsMenu = process.platform === 'darwin' ? 'Eien' : 'File';
const themeSource = (app: ElectronApplication) =>
  app.evaluate(({ nativeTheme }) => nativeTheme.themeSource);

async function openBook(page: Page): Promise<void> {
  await page.locator('.tree-row__label', { hasText: 'Book' }).click();
  await expect(page.locator('.note-row')).toHaveCount(2);
}

test('opens from the sidebar and the menu, and closes with Esc or a click outside', async ({
  app,
  page,
}) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('heading', { level: 2 })).toHaveText([
    'Look',
    'Themes',
    'Writing',
    'This vault',
  ]);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();

  await clickMenu(app, settingsMenu, 'Settings…');
  await expect(dialog(page)).toBeVisible();
  await page.mouse.click(4, 4); // the dimmed window, outside the screen
  await expect(dialog(page)).toBeHidden();
});

test('every typeface shows in itself and loads under the security policy', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  // The policy refuses data: fonts, so none may be inlined (Vite inlines files under 4 KB).
  const inlined = await page.evaluate(() => {
    const rules = (list: CSSRuleList): CSSRule[] =>
      [...list].flatMap((rule) =>
        rule instanceof CSSImportRule && rule.styleSheet ? rules(rule.styleSheet.cssRules) : [rule],
      );
    return [...document.styleSheets]
      .flatMap((sheet) => rules(sheet.cssRules))
      .filter(
        (rule) =>
          rule instanceof CSSFontFaceRule && rule.style.getPropertyValue('src').includes('data:'),
      ).length;
  });
  expect(inlined).toBe(0);
  await openBook(page);
  await page.locator('.note-row', { hasText: 'Two' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await goTo(page, 'Type');
  for (const [name, family] of Object.entries(FACES)) {
    await choose(page, 'Typeface', name);
    await expect.poll(() => style(page, '.cm-content', 'font-family')).toContain(family);
    const fonts = await page.evaluate(async (wanted) => {
      await document.fonts.ready;
      const faces = [...document.fonts].filter(
        (font) => font.family.replaceAll('"', '') === wanted,
      );
      return {
        loaded: faces.some((font) => font.status === 'loaded'),
        failed: faces.filter((font) => font.status === 'error').length,
      };
    }, family);
    expect(fonts, family).toEqual({ loaded: true, failed: 0 });
  }
  await choose(page, 'Typeface', 'Newsreader');
  await expect(root(page)).not.toHaveAttribute('data-face');
  expect(errors).toEqual([]);
});

/** The monos beside Plex Mono, each with its family's name (ui/theme/monos.css). */
const MONOS = {
  'JetBrains Mono': 'JetBrains Mono Variable',
  'Fira Code': 'Fira Code Variable',
  'Cascadia Code': 'Cascadia Code Variable',
  'Source Code Pro': 'Source Code Pro Variable',
  Iosevka: 'Iosevka',
  'Commit Mono': 'Commit Mono',
  'Space Mono': 'Space Mono',
  'Victor Mono': 'Victor Mono Variable',
  'Monaspace Radon': 'Monaspace Radon',
  'Comic Mono': 'Comic Mono',
};

test('every mono loads from its bundled files, as the interface font', async ({ page }) => {
  await openBook(page);
  await page.locator('.note-row', { hasText: 'One' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await goTo(page, 'Type');
  for (const [name, family] of Object.entries(MONOS)) {
    await choose(page, 'Interface font', name);
    await expect.poll(() => style(page, '.colophon', 'font-family')).toContain(family);
    const fonts = await page.evaluate(async (wanted) => {
      await document.fonts.ready;
      const faces = [...document.fonts].filter(
        (font) => font.family.replaceAll('"', '') === wanted,
      );
      return {
        loaded: faces.some((font) => font.status === 'loaded'),
        failed: faces.filter((font) => font.status === 'error').length,
      };
    }, family);
    expect(fonts, family).toEqual({ loaded: true, failed: 0 });
  }
  await choose(page, 'Interface font', 'IBM Plex Mono');
});

test('palette, density, page and text size change the look at once', async ({ page }) => {
  await openBook(page);
  await page.locator('.note-row', { hasText: 'One' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();

  await goTo(page, 'Gallery');
  await choose(page, 'Gallery', 'Slate');
  await expect(root(page)).toHaveAttribute('data-palette', 'slate');
  await expect(page.locator('.sidebar')).toHaveCSS('background-color', 'rgb(207, 212, 210)'); // Slate's desk, by day

  expect(await style(page, '.sheet', 'padding-top')).toBe('48px');
  await goTo(page, 'Appearance');
  await choose(page, 'Density', 'Compact');
  await expect(page.locator('.sheet')).toHaveCSS('padding-top', '24px');

  await goTo(page, 'Page');
  await choose(page, 'Page', 'Full');
  await expect(page.locator('.sheet')).toHaveCSS('box-shadow', 'none');
  await expect(page.locator('.page__scroll')).toHaveCSS('padding-top', '0px');

  const rowSize = async () => Number.parseFloat(await style(page, '.note-row__title', 'font-size'));
  expect(await rowSize()).toBe(16);
  await goTo(page, 'Type');
  const larger = control(page, 'Text size', 'Larger');
  const shown = dialog(page).getByRole('group', { name: 'Text size' }).locator('output');
  await larger.click();
  await expect(shown).toHaveText('110%');
  await expect.poll(rowSize).toBeCloseTo(17.6);
  await larger.click();
  await larger.click();
  await expect(shown).toHaveText('130%');
  await expect(larger).toBeDisabled(); // the top of the range
});

test('day or night from the sidebar’s toggle: the sun or the moon, whichever shows', async ({
  app,
  page,
}) => {
  const toggle = page.locator('.sidebar__foot').getByRole('button', { name: 'Night' });
  // It starts from the system's, day or night: by day first, whatever the machine's is.
  if ((await toggle.getAttribute('aria-pressed')) === 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle.locator('svg')).toHaveAttribute('data-icon', 'sun');

  await toggle.click();
  await expect(root(page)).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle.locator('svg')).toHaveAttribute('data-icon', 'moon');
  await expect(toggle).toHaveAttribute('data-tip', 'Night · switch to day');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(26, 23, 19)'); // the night blotter
  await expect.poll(() => themeSource(app)).toBe('dark'); // the window's frame follows too

  await toggle.click();
  await expect(root(page)).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => themeSource(app)).toBe('light');
});

test('this device’s choices come back after a restart; chapter numbers travel with the vault', async ({
  app,
  page,
  userData,
  vault,
}) => {
  await openBook(page);
  await expect(page.locator('.note-row__ord')).toHaveText(['i', 'ii']);
  await page.getByRole('button', { name: 'Settings' }).click();
  await goTo(page, 'Type');
  await choose(page, 'Typeface', 'Literata');
  await goTo(page, 'Appearance');
  await choose(page, 'Day or night', 'Night');
  await goTo(page, 'Writing'); // This vault's
  await choose(page, 'Chapter numbers', '1 2 3');
  await expect(page.locator('.note-row__ord')).toHaveText(['1', '2']);

  const deviceFile = join(userData, 'settings.json');
  const vaultFile = join(vault ?? '', '.eien', 'config.json');
  await expect
    .poll(() => existsSync(vaultFile) && readJson(vaultFile))
    .toEqual({ 'books.numerals': 'arabic' });
  expect(readJson(deviceFile)).toEqual({
    settings: { 'appearance.face': 'literata', 'appearance.scheme': 'night' },
  });
  await closeApp(app);

  const again = await launchApp(userData, vault);
  try {
    const page2 = await again.firstWindow();
    await expect(root(page2)).toHaveAttribute('data-face', 'literata');
    await expect(root(page2)).toHaveAttribute('data-theme', 'dark');
    expect(await themeSource(again)).toBe('dark'); // set before the window first drew
    await openBook(page2);
    await expect(page2.locator('.note-row__ord')).toHaveText(['1', '2']);
  } finally {
    await closeApp(again);
  }
});

test('chapter numbers changed on another device show at once', async ({ page, vault }) => {
  await openBook(page);
  await expect(page.locator('.note-row__ord')).toHaveText(['i', 'ii']);
  mkdirSync(join(vault ?? '', '.eien'), { recursive: true });
  writeFileSync(join(vault ?? '', '.eien', 'config.json'), '{ "books.numerals": "arabic" }\n');
  await expect(page.locator('.note-row__ord')).toHaveText(['1', '2'], { timeout: 5000 });
});

test('the window can set nothing that isn’t a setting', async ({ page, userData }) => {
  const outcomes = await page.evaluate(async () => {
    const set = window.eien.settings.set as (key: unknown, value: unknown) => Promise<unknown>;
    const tries: [unknown, unknown][] = [
      ['appearance.face', 'comic-sans'],
      ['appearance.nope', 'x'],
      ['__proto__', { polluted: true }],
      ['page.zoom', 1000],
      ['page.zoom', '120'],
      [{ toString: () => 'page.zoom' }, 120],
    ];
    return Promise.all(
      tries.map(([key, value]) =>
        set(key, value).then(
          () => 'kept',
          () => 'refused',
        ),
      ),
    );
  });
  expect(outcomes).toEqual(['refused', 'refused', 'refused', 'refused', 'refused', 'refused']);
  expect(existsSync(join(userData, 'settings.json'))).toBe(false);
});

test.describe('page zoom', () => {
  test('the page grows, the panes don’t, and a click still lands on its word', async ({
    app,
    page,
    vault,
  }) => {
    await openBook(page);
    await page.locator('.note-row', { hasText: 'One' }).click();
    await editorContent(page).click(); // the keyboard in the page: its zoom, not the window's
    const rowSize = await style(page, '.tree-row__label', 'font-size');
    for (let i = 0; i < 5; i++) await clickMenu(app, 'View', 'Zoom In');
    await expect(page.locator('.colophon__zoom')).toHaveText('150%');
    await expect(page.locator('.sheet')).toHaveCSS('zoom', '1.5');
    expect(await style(page, '.tree-row__label', 'font-size')).toBe(rowSize);

    // Double-click "gamma" where it is drawn, and replace it.
    const box = await editorLines(page)
      .first()
      .evaluate((line) => {
        const node = document.createTreeWalker(line, NodeFilter.SHOW_TEXT).nextNode();
        const at = node?.textContent?.indexOf('gamma') ?? -1;
        if (!node || at < 0) throw new Error('no "gamma" on the line');
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + 'gamma'.length);
        const rect = range.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      });
    await page.mouse.dblclick(box.x, box.y);
    await page.keyboard.type('GAMMA');
    await expect
      .poll(() => readFileSync(join(vault ?? '', 'Book', 'One.md'), 'utf8'), { timeout: 5000 })
      .toBe('alpha beta GAMMA delta\n');

    await clickMenu(app, 'View', 'Actual Size');
    await expect(page.locator('.colophon__zoom')).toBeHidden();
    await expect(page.locator('.sheet')).toHaveCSS('zoom', '1');
    for (let i = 0; i < 8; i++) await clickMenu(app, 'View', 'Zoom Out');
    await expect(page.locator('.colophon__zoom')).toHaveText('50%'); // and no further
    expect(await windowZoom(app)).toBe(1);
  });
});

test.describe('a settings file that’s wrong', () => {
  test.use({
    deviceFile: {
      settings: {
        'appearance.face': 'comic-sans',
        'appearance.palette': 'slate',
        'page.zoom': 'huge',
        'future.key': 7,
      },
    },
    vaultFiles: { ...BOOK, '.eien/config.json': '{ "books.numerals": "arabic", ' },
  });

  test('never stops the app: good values hold, bad ones fall back, unknown ones are kept', async ({
    page,
    userData,
  }) => {
    await expect(root(page)).toHaveAttribute('data-palette', 'slate');
    await expect(root(page)).not.toHaveAttribute('data-face');
    await expect(page.locator('.colophon__zoom')).toBeHidden();
    await openBook(page);
    await expect(page.locator('.note-row__ord')).toHaveText(['i', 'ii']); // the vault's file can't be read

    await page.getByRole('button', { name: 'Settings' }).click();
    await goTo(page, 'Type');
    await choose(page, 'Typeface', 'Hanken Grotesk');
    await expect
      .poll(() => (readJson(join(userData, 'settings.json')) as { settings: unknown }).settings)
      // Every other key stays as written; a bad one is ignored when read, not erased.
      .toEqual({
        'appearance.palette': 'slate',
        'page.zoom': 'huge',
        'future.key': 7,
        'appearance.face': 'hanken',
      });
  });

  test('won’t write over a vault file it can’t read, and says why', async ({ page, vault }) => {
    const file = join(vault ?? '', '.eien', 'config.json');
    await page.getByRole('button', { name: 'Settings' }).click();
    await goTo(page, 'Writing');
    await choose(page, 'Chapter numbers', '1 2 3');
    await expect(dialog(page).getByRole('alert')).toContainText('isn’t valid JSON');
    await expect(control(page, 'Chapter numbers', 'i ii iii')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(readFileSync(file, 'utf8')).toBe('{ "books.numerals": "arabic", ');
  });
});
