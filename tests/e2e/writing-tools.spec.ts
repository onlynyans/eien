// Phase 9a on the real app (spec §4): Enter on an empty line after an empty
// line makes a scene break; focus mode fades back every paragraph but the
// one being written; typewriter scrolling holds the line being written at
// the middle of the page. Both are this device's settings, turned on and
// off from the View menu or the settings screen, the menu's check following.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, editorContent, expect, test } from './launch';

const LONG = Array.from({ length: 80 }, (_, i) => `Paragraph ${i + 1} of the chapter.`).join(
  '\n\n',
);

test.use({
  vaultFiles: {
    'Scene.md': 'She left.\n',
    'Long.md': `${LONG}\n`,
  },
});

const readIn = (vault: string | null, path: string) =>
  readFileSync(join(vault ?? '', path), 'utf8');

async function open(page: Page, title: string): Promise<void> {
  await page.locator('.note-row', { hasText: title }).click();
  await expect(page.locator('.title')).toHaveText(title);
}

/** Whether the View menu's item is checked. */
const checked = (app: ElectronApplication, id: string) =>
  app.evaluate(({ Menu }, id) => Menu.getApplicationMenu()?.getMenuItemById(id)?.checked, id);

const deviceSettings = (userData: string) =>
  (JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8')) as { settings: unknown })
    .settings;

test('Enter on an empty line after an empty line makes a scene break', async ({ page, vault }) => {
  await open(page, 'Scene');
  // At the end of the words (⌘End would be on the empty line the file's last line end makes).
  await page.locator('.cm-line', { hasText: 'She left.' }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Wait.');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Morning.');
  await expect
    .poll(() => readIn(vault, 'Scene.md'))
    .toBe('She left.\n\nWait.\n\n***\n\nMorning.\n');
  await expect(page.locator('.eien-scene-break')).toBeVisible();
  // ⌘Z takes the scene break back with the typing.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => readIn(vault, 'Scene.md')).not.toContain('***');
});

test('View → Focus Mode fades back every paragraph but the caret’s, and the check follows', async ({
  app,
  page,
  userData,
}) => {
  await open(page, 'Long');
  await page.locator('.cm-line', { hasText: 'Paragraph 3 of' }).click();
  expect(await checked(app, 'editor.focus')).toBe(false);
  await clickMenu(app, 'View', 'Focus Mode');
  await expect(page.locator('.cm-editor')).toHaveClass(/eien-focus/);
  await expect(page.locator('.cm-line', { hasText: 'Paragraph 3 of' })).toHaveCSS('opacity', '1');
  await expect(page.locator('.cm-line', { hasText: 'Paragraph 4 of' })).not.toHaveCSS(
    'opacity',
    '1',
  );
  await expect.poll(() => checked(app, 'editor.focus')).toBe(true);
  expect(deviceSettings(userData)).toEqual({ 'editor.focus': 'on' });

  // The bright paragraph moves with the caret.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.cm-line', { hasText: 'Paragraph 4 of' })).toHaveCSS('opacity', '1');

  // Reading is for reading: nothing fades there.
  await clickMenu(app, 'View', 'Reading');
  await expect(page.locator('.cm-editor')).not.toHaveClass(/eien-focus/);
  await clickMenu(app, 'View', 'Live');
  await expect(page.locator('.cm-editor')).toHaveClass(/eien-focus/);

  // Off from the settings screen: the menu's check follows.
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('navigation').getByRole('button', { name: 'Editor' }).click();
  await expect(dialog.locator('.settings__crumbs')).toHaveText('Settings/Writing/Editor');
  await dialog.getByRole('group', { name: 'Focus' }).getByRole('button', { name: 'Off' }).click();
  await expect(page.locator('.cm-editor')).not.toHaveClass(/eien-focus/);
  await expect.poll(() => checked(app, 'editor.focus')).toBe(false);
});

test('typewriter scrolling holds the line being written at the middle of the page', async ({
  app,
  page,
}) => {
  await open(page, 'Long');
  await clickMenu(app, 'View', 'Typewriter Scrolling');
  await expect(page.locator('.cm-editor')).toHaveClass(/eien-typewriter/);
  await expect.poll(() => checked(app, 'editor.typewriter')).toBe(true);
  await editorContent(page).click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' And on.');
  // The line being written sits at the middle of the page's scroller, give or take a line.
  // CodeMirror scrolls in its next measure (an animation frame), so wait for it to land.
  const offset = () =>
    page.evaluate(() => {
      const scroller = document.querySelector('.page__scroll') as HTMLElement;
      const root = (document.querySelector('.editor-host') as HTMLElement).shadowRoot;
      const line = [...(root?.querySelectorAll<HTMLElement>('.cm-line') ?? [])].find((each) =>
        each.textContent?.includes('And on.'),
      );
      const box = scroller.getBoundingClientRect();
      const at = line?.getBoundingClientRect();
      return at ? Math.abs(at.top + at.height / 2 - (box.top + box.height / 2)) : Number.NaN;
    });
  await expect.poll(offset).toBeLessThan(40);
});

test('spellcheck: macOS’s own checker, off until asked for; not offered elsewhere', async ({
  app,
  page,
  userData,
}) => {
  const mac = process.platform === 'darwin';
  await open(page, 'Scene');
  await expect(editorContent(page)).toHaveAttribute('spellcheck', 'false');
  // A checker only on macOS: elsewhere Electron would download dictionaries from Google.
  const allowed = await app.evaluate(({ session }) =>
    session.defaultSession.isSpellCheckerEnabled(),
  );
  expect(allowed).toBe(mac);
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('navigation').getByRole('button', { name: 'Editor' }).click();
  await expect(dialog.getByRole('group', { name: 'Spellcheck' })).toHaveCount(mac ? 1 : 0);
  await page.keyboard.press('Escape');
  const item = await app.evaluate(({ Menu }) =>
    Boolean(Menu.getApplicationMenu()?.getMenuItemById('editor.spellcheck')),
  );
  expect(item).toBe(mac);
  if (!mac) return;

  await clickMenu(app, 'Edit', 'Check Spelling While Typing');
  await expect(editorContent(page)).toHaveAttribute('spellcheck', 'true');
  await expect.poll(() => checked(app, 'editor.spellcheck')).toBe(true);
  expect(deviceSettings(userData)).toEqual({ 'editor.spellcheck': 'on' });
  await clickMenu(app, 'Edit', 'Check Spelling While Typing');
  await expect(editorContent(page)).toHaveAttribute('spellcheck', 'false');
});
