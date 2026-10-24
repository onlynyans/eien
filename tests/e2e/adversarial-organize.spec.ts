// Adversarial: phase 6b on the real app — renames in place while the vault
// changes underneath, names at the length limit, a book's order synced from
// another device, and where the keyboard goes.

import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { editorContent, expect, fakeTrash, readQuietly, test } from './launch';

const BOOK = 'Fic/Scarf';
test.use({
  vaultFiles: {
    'Ideas.md': 'Snow on the walls.\n',
    'Research/Wool.md': 'Knitted wool runs.\n',
    [`${BOOK}/The Tear.md`]: 'The scarf catches.\n',
    [`${BOOK}/Seventeen.md`]: '"Look," he begins.\n',
    [`${BOOK}/Needle.md`]: 'A sewing kit.\n',
    [`${BOOK}/.eien-folder.json`]: JSON.stringify({
      order: ['The Tear.md', 'Needle.md', 'Seventeen.md'],
      book: {},
    }),
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
const folders = (vault: string | null) =>
  readdirSync(at(vault, ''), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

test.describe('renaming a folder in place', () => {
  test('a new folder can be named at a person’s pace', async ({ page, vault }) => {
    // organize.spec.ts types the name within milliseconds. A person takes a moment: by then
    // the watcher has reported the new folder, the sidebar has redrawn, and the field is dead.
    await page.locator('.sidebar').hover();
    await page.getByRole('button', { name: 'New folder' }).click();
    await expect(page.locator('.tree-row__field')).toBeFocused();
    await page.waitForTimeout(1000);
    await page.keyboard.type('Drafts');
    await page.keyboard.press('Enter');
    await expect.poll(() => folders(vault)).toContain('Drafts');
  });

  test('a new folder gets the whole name typed, though the open note saved meanwhile', async ({
    page,
    vault,
  }) => {
    // Write a line, then make a folder for it. The note's autosave lands while the name is
    // typed; its change redraws the sidebar, and the redraw ends the rename half-way.
    await row(page, 'Ideas').click();
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' More snow.');
    await page.locator('.sidebar').hover();
    await page.getByRole('button', { name: 'New folder' }).click();
    await expect(page.locator('.tree-row__field')).toBeFocused();
    await page.keyboard.type('Drafts for winter', { delay: 120 }); // an unhurried typist
    await page.keyboard.press('Enter');
    await expect.poll(() => folders(vault)).toContain('Drafts for winter');
  });

  test('another program’s change mid-rename never commits a half-typed name', async ({
    page,
    vault,
  }) => {
    await folder(page, 'Research').focus();
    await page.keyboard.press('F2');
    await expect(page.locator('.tree-row__field')).toBeFocused();
    await page.keyboard.type('Rea');
    writeFileSync(at(vault, 'From the phone.md'), 'synced\n'); // Syncthing, say
    await expect(page.locator('.sidebar__count')).toHaveText('6 notes');
    await page.waitForTimeout(300);
    expect(folders(vault)).toContain('Research'); // still being named: nothing renamed yet
    await expect(page.locator('.tree-row__field')).toBeFocused();
    await page.keyboard.type('ding');
    await page.keyboard.press('Enter');
    await expect.poll(() => folders(vault)).toContain('Reading');
  });
});

test('a note renamed to a long title goes on saving', async ({ page, vault }) => {
  await row(page, 'Ideas').click();
  await page.locator('.title').click();
  await page.keyboard.press('ControlOrMeta+a');
  // A long first sentence pasted as the title; the rename cuts it, leaving room for a save's temp
  // file (".<name>.<token>.eien.tmp", 19 bytes): 236 bytes.
  await page.keyboard.insertText('a'.repeat(300));
  await page.keyboard.press('Enter');
  const long = () => readdirSync(at(vault, '')).find((file) => /^a+\.md$/.test(file));
  await expect.poll(long).toBeTruthy();
  const name = long() ?? '';
  expect(name.length).toBe(236);
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' An hour of new words.');
  await expect
    .poll(() => readQuietly(at(vault, name)), { timeout: 5000 })
    .toContain('An hour of new words.');
});

test('a folder sent to a slow trash while its open note is typed in stays gone', async ({
  app,
  page,
  vault,
}) => {
  // The system's trash, played by a folder, taking a second and a half (a big folder, a
  // network drive, Windows' Recycle Bin).
  const trash = await fakeTrash(app, { delayMs: 1500 });
  try {
    await folder(page, 'Research').click();
    await row(page, 'Wool').click();
    await folder(page, 'Research').click({ button: 'right' });
    await page
      .getByRole('menuitem', {
        name: process.platform === 'win32' ? 'Move to the Recycle Bin' : 'Move to the trash',
      })
      .click();
    // The page is still there while the trash works, but holds still: the writer's line isn't taken.
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.waitForTimeout(1100);
    await page.keyboard.type(' And moths.');
    expect(await editorContent(page).textContent()).not.toContain('And moths.');
    await expect(page.locator('.list__notice')).toContainText('“Research” is in the');
    await page.waitForTimeout(2000); // past any autosave
    // The writer was told it's in the trash; the page closed. It mustn't come back on its own…
    expect(folders(vault)).not.toContain('Research');
    // …and the note is in the trash as it was saved, whole.
    expect(readFileSync(join(trash, 'Research', 'Wool.md'), 'utf8')).toBe('Knitted wool runs.\n');
  } finally {
    rmSync(trash, { recursive: true, force: true });
  }
});

test('a book put in order on another device shows in that order', async ({ page, vault }) => {
  await folder(page, 'Fic').click();
  await folder(page, 'Scarf').click();
  await expect(page.locator('.note-row__title')).toHaveText(['The Tear', 'Needle', 'Seventeen']);
  // Syncthing brings the folder's order from the phone, where Seventeen was dragged first.
  writeFileSync(
    at(vault, `${BOOK}/.eien-folder.json`),
    JSON.stringify({ order: ['Seventeen.md', 'The Tear.md', 'Needle.md'], book: {} }),
  );
  await expect(page.locator('.note-row__title')).toHaveText(['Seventeen', 'The Tear', 'Needle'], {
    timeout: 5000,
  });
});

test.describe('the keyboard’s place in the sidebar', () => {
  test('All Notes keeps focus when its count changes', async ({ page, vault }) => {
    await folder(page, 'All Notes').focus();
    writeFileSync(at(vault, 'From the phone.md'), 'synced\n');
    await expect(page.locator('.sidebar__count')).toHaveText('6 notes');
    await expect(folder(page, 'All Notes')).toBeFocused();
  });

  test('Esc in a folder’s rename gives the keyboard back to the folder', async ({ page }) => {
    await folder(page, 'Research').focus();
    await page.keyboard.press('F2');
    await expect(page.locator('.tree-row__field')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(folder(page, 'Research')).toBeFocused();
  });
});
