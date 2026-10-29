// A book's row on SHELF (#40, after Phase 1): its menu, by right-click or the
// keyboard, renames it in its row, moves it and sends it to the system's
// trash, as a note's does. Its reading place is kept by what it holds, so it
// goes where the book goes; and in the trash the book is whole.

import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { closeApp, expect, fakeTrash, launchApp, ROOT, test } from './launch';

const PLAIN = readFileSync(join(ROOT, 'tests/fixtures/epub/plain.epub'));
const TRASH = process.platform === 'win32' ? 'Move to the Recycle Bin' : 'Move to the trash';

const book = (page: Page, title: string) =>
  page
    .locator('.tree-row--epub .tree-row__name')
    .filter({ has: page.locator('.tree-row__label', { hasText: new RegExp(`^${title}$`, 'u') }) });
const chapter = (page: Page) => page.locator('.page__leaf--epub .epub-chapter');
const at = (vault: string | null, path: string) => join(vault ?? '', ...path.split('/'));

test.use({
  vaultFiles: {
    'Novels/Pride and Prejudice.epub': PLAIN,
    'Fic/Draft.md': 'A draft.\n',
  },
});

test('a book’s row menu: its name at the head, Rename, Move to… and the trash last', async ({
  page,
}) => {
  await book(page, 'Pride and Prejudice').click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Pride and Prejudice' });
  await expect(menu.locator('.menu__head')).toHaveText('Pride and Prejudice');
  await expect(menu.getByRole('menuitem')).toHaveText(['Rename', 'Move to…', TRASH]);
  await expect(menu.getByRole('menuitem', { name: 'Rename' })).toHaveAttribute(
    'aria-keyshortcuts',
    'F2',
  );
  await expect(menu.getByRole('menuitem').last()).toHaveClass(/is-danger/u);
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  // From the keyboard too: the menu key's stand-in, Shift+F10.
  await book(page, 'Pride and Prejudice').focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(book(page, 'Pride and Prejudice')).toBeFocused();
});

test('renamed in its row and moved, the book keeps its .epub, its page and its place', async ({
  page,
  app,
  vault,
  userData,
}) => {
  await book(page, 'Pride and Prejudice').click();
  await page.locator('.contents-row').nth(2).click();
  await expect(chapter(page)).toContainText('Not all that Mrs. Bennet');
  const reading = at(vault, '.eien/reading');
  await expect.poll(() => readdirSync(reading).filter((n) => n.endsWith('.json'))).toHaveLength(1);

  // Rename, from the menu: the name in its row, its .epub faded after it.
  await book(page, 'Pride and Prejudice').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const field = page.locator('.name-field__input');
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Pride and Prejudice');
  await expect(page.locator('.name-field__suffix')).toHaveText('.epub');
  await page.keyboard.type('First Impressions');
  await page.keyboard.press('Enter');
  await expect.poll(() => existsSync(at(vault, 'Novels/First Impressions.epub'))).toBe(true);
  await expect.poll(() => existsSync(at(vault, 'Novels/Pride and Prejudice.epub'))).toBe(false);
  await expect(book(page, 'First Impressions')).toHaveAttribute('aria-current', 'true');
  await expect(chapter(page)).toContainText('Not all that Mrs. Bennet');
  // Its contents still in the list, under its own title: they follow the file.
  await expect(page.locator('.list__heading')).toHaveText('Pride and Prejudice');
  await expect(page.locator('.contents-row')).toHaveCount(3);

  // Move, from the keyboard: Shift+F10, Move to…, Fic.
  await book(page, 'First Impressions').focus();
  await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'Move to…' }).click();
  await page
    .getByRole('menu', { name: 'Move “First Impressions” to' })
    .getByRole('menuitem', { name: 'Fic' })
    .click();
  await expect.poll(() => existsSync(at(vault, 'Fic/First Impressions.epub'))).toBe(true);
  expect(existsSync(at(vault, 'Novels/First Impressions.epub'))).toBe(false);
  await expect(chapter(page)).toContainText('Not all that Mrs. Bennet');
  await expect(page.locator('.contents-row')).toHaveCount(3);
  // Its file was never written: the same book, under another name, somewhere else.
  expect(readFileSync(at(vault, 'Fic/First Impressions.epub'))).toEqual(PLAIN);

  // The place is the book's, not its path's: the same chapter after a restart, one state kept.
  await closeApp(app);
  const again = await launchApp(userData, vault);
  const next = await again.firstWindow();
  await book(next, 'First Impressions').click();
  await expect(chapter(next)).toContainText('Not all that Mrs. Bennet');
  expect(readdirSync(reading).filter((n) => n.endsWith('.json'))).toHaveLength(1);
  await closeApp(again);
});

test('trashed, the book goes whole to the system’s trash, and the window says where', async ({
  app,
  page,
  vault,
}) => {
  const trash = await fakeTrash(app);
  try {
    await book(page, 'Pride and Prejudice').click();
    await expect(chapter(page)).toContainText('It is a truth');
    await book(page, 'Pride and Prejudice').click({ button: 'right' });
    await page.getByRole('menuitem', { name: TRASH }).click();
    await expect(page.locator('.list__notice')).toContainText('“Pride and Prejudice” is in the');
    await expect(book(page, 'Pride and Prejudice')).toHaveCount(0);
    // Its page lets it go, and the list shows notes again.
    await expect(chapter(page)).toBeHidden();
    await expect(page.locator('.contents-row')).toHaveCount(0);
    expect(existsSync(at(vault, 'Novels/Pride and Prejudice.epub'))).toBe(false);
    // Words are never lost: in the trash, as it was.
    expect(readFileSync(join(trash, 'Pride and Prejudice.epub'))).toEqual(PLAIN);
  } finally {
    rmSync(trash, { recursive: true, force: true });
  }
});

test('the trash’s key on a book’s row, and a trash that fails deletes nothing', async ({
  app,
  page,
  vault,
}) => {
  const trash = await fakeTrash(app, { works: false });
  try {
    await book(page, 'Pride and Prejudice').focus();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Backspace' : 'Control+Delete');
    await expect(page.locator('.list__notice')).toContainText('so nothing was deleted');
    expect(readFileSync(at(vault, 'Novels/Pride and Prejudice.epub'))).toEqual(PLAIN);
    await expect(book(page, 'Pride and Prejudice')).toBeVisible();
  } finally {
    rmSync(trash, { recursive: true, force: true });
  }
});
