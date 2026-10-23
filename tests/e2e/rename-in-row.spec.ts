// Backlog #29 on the real app: a note renamed in its row (F2, a double-click on
// its name, or the row's menu), in the list or the tree, and the right-click
// menu of Eien's own: the row's name at its head, an icon, a word and a key
// for each choice, the trash last in carmine.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './launch';

test.use({
  vaultFiles: {
    'Ideas.md': 'Snow on the walls.\n',
    'Thaw.md': 'The ice goes.\n',
    'Research/Wool.md': 'Knitted wool runs.\n',
  },
});

const at = (vault: string | null, path: string) => join(vault ?? '', ...path.split('/'));
const row = (page: Page, title: string) =>
  page
    .locator('.note-row')
    .filter({ has: page.locator('.note-row__title', { hasText: new RegExp(`^${title}$`) }) });
const folder = (page: Page, name: string) =>
  page
    .locator('.tree-row__name')
    .filter({ has: page.locator('.tree-row__label', { hasText: new RegExp(`^${name}$`) }) });
const field = (page: Page) => page.locator('.name-field__input');
const problem = (page: Page) => page.locator('.name-field__problem');

test('a row’s menu: its name at the head, a word and its key for each choice, the trash last', async ({
  page,
}) => {
  await row(page, 'Ideas').click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Ideas' });
  await expect(menu).toBeVisible();
  await expect(menu.locator('.menu__head')).toHaveText('Ideas');
  await expect(menu.locator('.menu__head')).toHaveAttribute('aria-hidden', 'true');
  const rename = menu.getByRole('menuitem', { name: 'Rename', exact: true });
  await expect(rename).toHaveAttribute('aria-keyshortcuts', 'F2');
  await expect(rename.locator('.menu__keys')).toHaveAttribute('data-keys', 'F2');
  await expect(rename).toHaveText('Rename');
  await expect(rename.locator('svg.icon')).toHaveCount(1);
  const items = menu.getByRole('menuitem');
  const last = items.last();
  await expect(last).toHaveClass(/is-danger/);
  await expect(last).toHaveText(/trash|Recycle Bin/);
  // The keyboard: the first choice has it (where the note opens, on the desktop), ↓ moves, Esc
  // gives it back to the row.
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('F2 renames a note in its row: Enter keeps the name, and the file has it', async ({
  page,
  vault,
}) => {
  await row(page, 'Ideas').focus();
  await page.keyboard.press('F2');
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue('Ideas');
  await expect(page.locator('.name-field__suffix')).toHaveText('.md');
  // The whole name is chosen: typing replaces it.
  await page.keyboard.type('Frost');
  await page.keyboard.press('Enter');
  await expect.poll(() => existsSync(at(vault, 'Frost.md'))).toBe(true);
  // A move links the new name, then unlinks the old: the old one goes a moment after.
  await expect.poll(() => existsSync(at(vault, 'Ideas.md'))).toBe(false);
  expect(readFileSync(at(vault, 'Frost.md'), 'utf8')).toBe('Snow on the walls.\n');
  await expect(row(page, 'Frost')).toBeFocused();
  await expect(field(page)).toHaveCount(0);
});

test('Esc puts the old name back and the keyboard on the row; nothing on disk changes', async ({
  page,
  vault,
}) => {
  await row(page, 'Ideas').focus();
  await page.keyboard.press('F2');
  await page.keyboard.type('Something else');
  await page.keyboard.press('Escape');
  await expect(field(page)).toHaveCount(0);
  await expect(row(page, 'Ideas')).toBeFocused();
  await page.waitForTimeout(500);
  expect(
    readdirSync(at(vault, ''))
      .filter((name) => name.endsWith('.md'))
      .sort(),
  ).toEqual(['Ideas.md', 'Thaw.md']);
});

test('a name that’s taken says so under the row, in any case, and the field stays open', async ({
  page,
  vault,
}) => {
  await row(page, 'Ideas').focus();
  await page.keyboard.press('F2');
  await page.keyboard.type('thaw');
  await expect(problem(page)).toBeVisible();
  await expect(problem(page)).toHaveText('There is one of that name here already.');
  await expect(field(page)).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Enter');
  await expect(field(page)).toBeFocused();
  expect(existsSync(at(vault, 'Ideas.md'))).toBe(true);
  // Typed on, the line goes, and the name can be kept.
  await page.keyboard.type(' later');
  await expect(problem(page)).toBeHidden();
  await page.keyboard.press('Enter');
  await expect.poll(() => existsSync(at(vault, 'thaw later.md'))).toBe(true);
});

test('a double-click on a note’s name renames it; one click only opens it', async ({ page }) => {
  await row(page, 'Thaw').locator('.note-row__title').click();
  await expect(page.locator('.title')).toHaveText('Thaw');
  await expect(field(page)).toHaveCount(0);
  await page.waitForTimeout(600); // well past a double-click
  await row(page, 'Thaw').locator('.note-row__title').dblclick();
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue('Thaw');
  await page.keyboard.press('Escape');
});

test('a note arriving from another device mid-rename leaves the field and its words', async ({
  page,
  vault,
}) => {
  await row(page, 'Ideas').focus();
  await page.keyboard.press('F2');
  await page.keyboard.type('Half typ');
  writeFileSync(at(vault, 'From the phone.md'), 'synced\n');
  await expect(row(page, 'From the phone')).toBeVisible();
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue('Half typ');
  await page.keyboard.type('ed');
  await page.keyboard.press('Enter');
  await expect.poll(() => existsSync(at(vault, 'Half typed.md'))).toBe(true);
});

test('⇧⌘P (Ctrl+Shift+P) on a row pins the note, and again unpins it', async ({ page, vault }) => {
  await row(page, 'Thaw').focus();
  await page.keyboard.press('ControlOrMeta+Shift+P');
  await expect
    .poll(() => {
      try {
        return readFileSync(at(vault, '.eien/pinned.json'), 'utf8');
      } catch {
        return '';
      }
    })
    .toContain('Thaw.md');
  await row(page, 'Thaw').focus();
  await page.keyboard.press('ControlOrMeta+Shift+P');
  await expect
    .poll(() => readFileSync(at(vault, '.eien/pinned.json'), 'utf8'))
    .not.toContain('Thaw.md');
});

test('a folder renames by F2, not a double-click: a click opens it and the next shuts it', async ({
  page,
}) => {
  await folder(page, 'Research').locator('.tree-row__label').dblclick();
  await expect(page.locator('.tree-row__field')).toHaveCount(0);
  await folder(page, 'Research').press('F2');
  await expect(page.locator('.tree-row__field')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(folder(page, 'Research')).toBeFocused();
});

test.describe('in a long list', () => {
  test.use({
    vaultFiles: Object.fromEntries(
      Array.from({ length: 250 }, (_, i) => [`Note ${String(i).padStart(3, '0')}.md`, `${i}\n`]),
    ),
  });

  test('a row reached past the rows drawn renames in place', async ({ page, vault }) => {
    await expect(page.locator('.rows > li[aria-setsize="250"]').first()).toBeVisible({
      timeout: 30_000,
    });
    await page.locator('.rows .note-row').first().focus();
    await page.keyboard.press('End');
    const last = page.locator('.rows .note-row:focus');
    await expect(last).toHaveAttribute('data-path', /Note \d+\.md/);
    const path = await last.getAttribute('data-path');
    await page.keyboard.press('F2');
    await expect(field(page)).toBeFocused();
    await page.keyboard.type('The last one');
    await page.keyboard.press('Enter');
    await expect.poll(() => existsSync(at(vault, 'The last one.md'))).toBe(true);
    await expect.poll(() => existsSync(at(vault, path ?? ''))).toBe(false);
  });
});
