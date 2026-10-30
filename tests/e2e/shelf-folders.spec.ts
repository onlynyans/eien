// FOLDERS for writing, SHELF for reading (#40, decided 2026-10-29): a folder
// of books and nothing else is on SHELF only, where it's a folder row of its
// own: it shuts and opens (kept after a restart), and has the folder's menu,
// so it's renamed, moved and trashed from there. A note made in it brings it
// into FOLDERS; its last note gone, it leaves; the list keeps it chosen, and
// a drop onto it lands.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ALONE, closeApp, expect, fakeTrash, launchApp, ROOT, test } from './launch';

const PLAIN = readFileSync(join(ROOT, 'tests/fixtures/epub/plain.epub'));
const TRASH = process.platform === 'win32' ? 'Move to the Recycle Bin' : 'Move to the trash';
const at = (vault: string | null, path: string) => join(vault ?? '', ...path.split('/'));

/** A folder's row in FOLDERS, and on SHELF. */
const inFolders = (page: Page, path: string) => page.locator(`[data-key="folder:${path}"]`);
const onShelf = (page: Page, path: string) => page.locator(`[data-key="shelf:${path}"]`);
const book = (page: Page, title: string) =>
  page.locator('.tree-row--epub .tree-row__name').filter({ hasText: new RegExp(`^${title}$`) });
const noteRow = (page: Page, title: string) =>
  page
    .locator('.note-row')
    .filter({ has: page.locator('.note-row__title', { hasText: new RegExp(`^${title}$`) }) });

test.use({
  vaultFiles: {
    'Novels/Emma.epub': PLAIN,
    'Novels/Russian/Anna.epub': PLAIN,
    'Drafts/One.md': 'A draft.\n',
    'Reading/On Anna.md': 'Notes on Anna.\n',
    'Reading/Persuasion.epub': PLAIN,
  },
});

test('a folder of books alone is on SHELF only; a note made there brings it into FOLDERS, its last note gone sends it back', async ({
  app,
  page,
}) => {
  await expect(inFolders(page, 'Drafts')).toBeVisible();
  await expect(inFolders(page, 'Reading')).toBeVisible(); // notes and books: in both
  await expect(onShelf(page, 'Reading')).toBeVisible();
  await expect(inFolders(page, 'Novels')).toHaveCount(0);
  await expect(onShelf(page, 'Novels')).toBeVisible();
  await expect(onShelf(page, 'Novels/Russian')).toBeVisible();

  // The folder's own menu, from SHELF: the same as FOLDERS'.
  await onShelf(page, 'Novels').click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Novels' });
  await expect(menu.getByRole('menuitem')).toContainText([
    'New note here',
    'New folder inside',
    'Rename',
    'Move to…',
    TRASH,
  ]);
  await menu.getByRole('menuitem', { name: 'New note here' }).click();
  await expect(inFolders(page, 'Novels')).toBeVisible();
  await expect(onShelf(page, 'Novels')).toBeVisible();

  // Chosen in FOLDERS, its one note trashed: it leaves FOLDERS, and the list keeps it chosen.
  const trash = await fakeTrash(app);
  await inFolders(page, 'Novels').click();
  await expect(page.locator('.list__heading')).toHaveText('Novels');
  await noteRow(page, 'Untitled').click({ button: 'right' });
  await page.getByRole('menuitem', { name: TRASH }).click();
  await expect(inFolders(page, 'Novels')).toHaveCount(0);
  await expect(page.locator('.list__heading')).toHaveText('Novels');
  await expect(page.locator('.list__body .note-row')).toHaveCount(0);
  expect(readdirSync(trash)).toEqual(['Untitled.md']);
  // Until another is chosen.
  await inFolders(page, 'Drafts').click();
  await expect(page.locator('.list__heading')).toHaveText('Drafts');
});

test('a folder on SHELF shuts and opens by its twisty or its name, and stays shut after a restart', async ({
  app,
  page,
  vault,
  userData,
}) => {
  await expect(book(page, 'Anna')).toBeVisible();
  const twist = page.locator('[data-key="twist:/shelf/Novels"]');
  await expect(twist).toHaveAttribute('aria-label', 'Close Novels');
  await twist.click();
  await expect(book(page, 'Anna')).toHaveCount(0);
  await expect(book(page, 'Emma')).toHaveCount(0);
  await expect(onShelf(page, 'Novels')).toHaveAttribute('aria-expanded', 'false');
  await expect(book(page, 'Persuasion')).toBeVisible(); // another folder's books, still in sight

  await closeApp(app);
  const again = await launchApp(userData, vault);
  const next = await again.firstWindow();
  await expect(onShelf(next, 'Novels')).toHaveAttribute('aria-expanded', 'false');
  await expect(book(next, 'Emma')).toHaveCount(0);
  await onShelf(next, 'Novels').click();
  await expect(book(next, 'Emma')).toBeVisible();
  await expect(onShelf(next, 'Novels')).toHaveAttribute('aria-expanded', 'true');
  await closeApp(again);
});

test('renamed, moved and trashed from SHELF, by its keys and its menu, the keyboard kept on its row', async ({
  app,
  page,
  vault,
}) => {
  // Shut first: the fold follows the folder wherever it goes.
  await page.locator('[data-key="twist:/shelf/Novels"]').click();

  // F2 renames it in its row on SHELF, where it is.
  await onShelf(page, 'Novels').focus();
  await page.keyboard.press('F2');
  const field = page.locator('#sidebar-shelf .tree-row__field');
  await expect(field).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Classics');
  await page.keyboard.press('Enter');
  await expect.poll(() => existsSync(at(vault, 'Classics/Emma.epub'))).toBe(true);
  await expect(onShelf(page, 'Classics')).toBeFocused();
  await expect(onShelf(page, 'Classics')).toHaveAttribute('aria-expanded', 'false');
  await expect(inFolders(page, 'Classics')).toHaveCount(0);

  // ⌥↓ moves it among SHELF's folders: past Reading, and Drafts (not on SHELF) is no step.
  await page.keyboard.press('Alt+ArrowDown');
  await expect(page.locator('#sidebar-shelf .tree-row--shelf-folder')).toHaveText([
    'Reading',
    'Classics',
  ]);
  await expect(onShelf(page, 'Classics')).toBeFocused();

  // ⌥→ into the folder SHELF shows above it, shut there: it opens, and the keyboard follows.
  await page.locator('[data-key="twist:/shelf/Reading"]').click();
  await onShelf(page, 'Classics').focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect.poll(() => existsSync(at(vault, 'Reading/Classics/Emma.epub'))).toBe(true);
  await expect(onShelf(page, 'Reading')).toHaveAttribute('aria-expanded', 'true');
  await expect(onShelf(page, 'Reading/Classics')).toBeFocused();

  // Move to… lists every folder, Drafts too, which isn't on SHELF; moved there, it is.
  await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'Move to…' }).click();
  await page
    .getByRole('menu', { name: 'Move “Classics” to' })
    .getByRole('menuitem', { name: 'Drafts' })
    .click();
  await expect.poll(() => existsSync(at(vault, 'Drafts/Classics/Emma.epub'))).toBe(true);
  await expect(onShelf(page, 'Drafts/Classics')).toBeFocused();
  await expect(onShelf(page, 'Drafts')).toHaveAttribute('aria-expanded', 'true');

  // To the trash from its menu, whole.
  const trash = await fakeTrash(app);
  await onShelf(page, 'Drafts/Classics').click({ button: 'right' });
  await page.getByRole('menuitem', { name: TRASH }).click();
  await expect(onShelf(page, 'Drafts/Classics')).toHaveCount(0);
  expect(readdirSync(join(trash, 'Classics')).sort()).toEqual(['Emma.epub', 'Russian']);
  expect(existsSync(at(vault, 'Drafts/Classics'))).toBe(false);
});

test(
  'a note dropped on a folder on SHELF lands there, and both folders change sides',
  ALONE,
  async ({ page, vault }) => {
    await inFolders(page, 'Reading').click();
    const from = await noteRow(page, 'On Anna').boundingBox();
    const to = await onShelf(page, 'Novels').boundingBox();
    if (!from || !to) throw new Error('nothing to drag');
    await page.mouse.move(from.x + 30, from.y + 10);
    await page.mouse.down();
    await page.mouse.move(to.x + 30, to.y + 10, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => existsSync(at(vault, 'Novels/On Anna.md'))).toBe(true);
    await expect.poll(() => existsSync(at(vault, 'Reading/On Anna.md'))).toBe(false);
    await expect(inFolders(page, 'Novels')).toBeVisible();
    await expect(inFolders(page, 'Reading')).toHaveCount(0); // books alone now
    await expect(onShelf(page, 'Reading')).toBeVisible();
    await expect(page.locator('.list__heading')).toHaveText('Reading');
  },
);
