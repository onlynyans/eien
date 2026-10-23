// The formatting bar (backlog #14): the Format menu's commands as Eien's
// own icons, in each layout's place (A's band's second row, B's slip at the
// blotter's top, C's rail in the margin). Shown and hidden from its control
// or View → Formatting Bar, kept as this device's setting; each button runs
// the menu's command, and shows pressed where its format is on at the caret.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { clickMenu, editorContent, expect, test } from './launch';

test.use({ vaultFiles: { 'Note.md': 'Some plain words.\n' } });

const MAC = process.platform === 'darwin';
const readIn = (vault: string | null, path: string) =>
  readFileSync(join(vault ?? '', path), 'utf8');
const bar = (page: Page) => page.getByRole('toolbar', { name: 'Format' });
const button = (page: Page, command: string) => bar(page).locator(`[data-command="${command}"]`);
const toggle = (page: Page) =>
  page.locator('[data-command="format-bar"]:not(.phone-bar__controls *, .page__phone *)');
/** The setting as this device's file has it. */
const setting = (page: Page) =>
  page.evaluate(async () => (await window.eien.settings.read())['editor.formatBar']);

/** The bar's commands, in its order (the headings one control). */
const COMMANDS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'heading',
  'highlight',
  'link',
  'quote',
  'bullet',
  'numbered',
  'checklist',
  'table',
].map((id) => `format.${id}`);

for (const layout of ['band', 'slip', 'runhead'] as const) {
  test.describe(`the ${layout} layout`, () => {
    test.use({ deviceFile: { settings: { 'appearance.layout': layout } } });

    test('shows and hides the bar, and its buttons format the note', async ({
      app,
      page,
      vault,
    }) => {
      await page.locator('.note-row', { hasText: 'Note' }).click();
      await expect(page.locator('.title')).toHaveText('Note');
      // Off at first: nothing over the page the writer didn't ask for.
      await expect(bar(page)).toBeHidden();
      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
      await toggle(page).click();
      await expect(bar(page)).toBeVisible();
      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => setting(page)).toBe('on');

      // Every command, drawn, named, with its tooltip and key.
      await expect(bar(page).locator('[data-command]')).toHaveCount(COMMANDS.length);
      for (const [i, command] of COMMANDS.entries()) {
        const each = bar(page).locator('[data-command]').nth(i);
        await expect(each).toHaveAttribute('data-command', command);
        await expect(each.locator('svg')).toHaveCount(1);
        await expect(each).toHaveAttribute('aria-label', /\w/);
        await expect(each).toHaveAttribute('data-tip', /\w/);
      }
      await expect(button(page, 'format.bold')).toHaveAttribute(
        'data-shortcut',
        MAC ? '⌘B' : 'Ctrl+B',
      );
      await expect(button(page, 'format.heading')).toHaveAttribute(
        'data-shortcut',
        MAC ? '⌥⌘1–3' : 'Ctrl+Shift+1–3',
      );

      // Bold on a chosen word, from the bar: the file has it, and the button shows it's on.
      await editorContent(page).click();
      await page.keyboard.press('ControlOrMeta+Home'); // the note's start
      for (let i = 0; i < 'Some'.length; i++) await page.keyboard.press('Shift+ArrowRight');
      await expect(button(page, 'format.bold')).toHaveAttribute('aria-pressed', 'false');
      await button(page, 'format.bold').click();
      await expect
        .poll(() => readIn(vault, 'Note.md'), { timeout: 5000 })
        .toBe('**Some** plain words.\n');
      await expect(editorContent(page)).toBeFocused(); // back to the words, to type on
      await expect(button(page, 'format.bold')).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('End');
      await expect(button(page, 'format.bold')).toHaveAttribute('aria-pressed', 'false');

      // The heading control: a level down each press, then none.
      await button(page, 'format.heading').click();
      await expect
        .poll(() => readIn(vault, 'Note.md'), { timeout: 5000 })
        .toBe('# **Some** plain words.\n');
      await expect(button(page, 'format.heading')).toHaveAttribute('aria-pressed', 'true');
      await button(page, 'format.heading').click();
      await expect
        .poll(() => readIn(vault, 'Note.md'), { timeout: 5000 })
        .toBe('## **Some** plain words.\n');

      // In Reading there's nothing to format.
      await page.getByRole('button', { name: 'Reading', exact: true }).click();
      await expect(button(page, 'format.bold')).toBeDisabled();
      await page.getByRole('button', { name: 'Live', exact: true }).click();
      await expect(button(page, 'format.bold')).toBeEnabled();

      // Hidden again from the View menu, as ⇧⌘B does.
      await clickMenu(app, 'View', 'Formatting Bar');
      await expect(bar(page)).toBeHidden();
      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
      await expect.poll(() => setting(page)).toBe('off');
    });

    test('the keyboard reaches every button, the arrows moving along the bar', async ({ page }) => {
      await page.locator('.note-row', { hasText: 'Note' }).click();
      await toggle(page).click();
      await button(page, 'format.bold').focus();
      for (const command of COMMANDS.slice(1)) {
        await page.keyboard.press(layout === 'runhead' ? 'ArrowDown' : 'ArrowRight');
        await expect(button(page, command)).toBeFocused();
      }
      // The keyboard on a button shows its tooltip: its words, then its key.
      await expect(page.locator('.tooltip__words')).toHaveText('Table');
      await expect(page.locator('.tooltip__key')).toHaveText(MAC ? '⇧⌘T' : 'Ctrl+Shift+T');
    });
  });
}

test.describe('the Table button', () => {
  test.use({ deviceFile: { settings: { 'editor.formatBar': 'on' } } });

  test('puts a small table after the caret’s line, the caret in its first cell', async ({
    page,
    vault,
  }) => {
    await page.locator('.note-row', { hasText: 'Note' }).click();
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+Home');
    await button(page, 'format.table').click();
    await page.keyboard.type('Name');
    await expect
      .poll(() => readIn(vault, 'Note.md'), { timeout: 5000 })
      .toBe('Some plain words.\n\n| Name |  |\n| --- | --- |\n|  |  |\n|  |  |\n');
  });
});

test.describe('shown when the app opens again', () => {
  test.use({ deviceFile: { settings: { 'editor.formatBar': 'on' } } });

  test('keeps the setting: the bar is there, its control pressed', async ({ page }) => {
    await page.locator('.note-row', { hasText: 'Note' }).click();
    await expect(bar(page)).toBeVisible();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(button(page, 'format.italic')).toBeEnabled();
  });

  test('with no note open, its buttons have nothing to do', async ({ page }) => {
    await expect(page.locator('.page__empty')).toBeVisible();
    await expect(bar(page)).toBeVisible();
    await expect(button(page, 'format.italic')).toBeDisabled();
  });
});
