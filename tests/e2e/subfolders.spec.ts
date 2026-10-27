// Backlog #42 on the real app: a folder's list with its subfolders' notes
// too. Your order holds: the folder's own notes, then each subfolder's under
// its name, in your folder order; Arrange moves a note within its group, and a
// drag into another group moves the note to that folder.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ALONE, boxOf, expect, test } from './launch';

const at = (vault: string | null, path: string) => join(vault ?? '', ...path.split('/'));
const orderOf = (vault: string | null, folder: string): string[] => {
  const file = at(vault, `${folder}/.eien-folder.json`);
  return existsSync(file)
    ? ((JSON.parse(readFileSync(file, 'utf8')) as { order?: string[] }).order ?? [])
    : [];
};
const titles = (page: Page) => page.locator('.list .note-row__title');
const heads = (page: Page) => page.locator('.list .note-group');
const fic = (page: Page) => page.locator('.tree-row__name[data-key="folder:Fic"]').click();
const toggle = (page: Page) => page.locator('.list [data-key="lens-subfolders:list"]');
const row = (page: Page, title: string) =>
  page
    .locator('.list .note-row')
    .filter({ has: page.locator('.note-row__title', { hasText: new RegExp(`^${title}$`) }) });

async function includeSubfolders(page: Page): Promise<void> {
  await fic(page);
  await page.locator('.list').hover();
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
}

/** A folder's notes in its order (the order lists its folders too). */
const notesOrder = (vault: string | null, folder: string) =>
  orderOf(vault, folder).filter((name) => name.endsWith('.md'));

/** Drag `from`'s row and let it go just inside `to`'s top edge: before `to`. */
async function dragOnto(page: Page, from: string, to: string): Promise<void> {
  const a = await boxOf(row(page, from));
  const b = await boxOf(row(page, to));
  await page.mouse.move(a.x + 40, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 40, b.y + 3, { steps: 8 });
  await page.mouse.up();
}

test.use({
  vaultFiles: {
    'Fic/Own.md': 'The folder’s own.\n',
    'Fic/Arc 1/One.md': 'One.\n',
    'Fic/Arc 1/Two.md': 'Two.\n',
    'Fic/Arc 1/.eien-folder.json': JSON.stringify({ order: ['One.md', 'Two.md'] }),
    'Fic/Arc 2/Three.md': 'Three, by the lake.\n',
    'Fic/Arc 2/Four.md': 'Four.\n',
    'Fic/Arc 2/.eien-folder.json': JSON.stringify({ order: ['Three.md', 'Four.md'] }),
    'Fic/Arc 2/Cut/Five.md': 'Five, by the lake.\n',
    'Fic/.eien-folder.json': JSON.stringify({ order: ['Arc 2', 'Arc 1'] }),
  },
});

test('Include subfolders lists each subfolder’s notes under its name, in your order', async ({
  page,
}) => {
  await fic(page);
  await expect(titles(page)).toHaveText(['Own']);
  await expect(heads(page)).toHaveCount(0);
  await includeSubfolders(page);
  await expect(titles(page)).toHaveText(['Own', 'Three', 'Four', 'Five', 'One', 'Two']);
  await expect(heads(page)).toHaveText(['Arc 2', 'Arc 2 / Cut', 'Arc 1']);
  await expect(page.locator('.list .list__count')).toHaveText('6 notes · With subfolders');
  // The arrows go from row to row across the groups; a head is never a stop.
  await row(page, 'Own').focus();
  await page.keyboard.press('ArrowDown');
  await expect(row(page, 'Three')).toBeFocused();
  await page.keyboard.press('End');
  await expect(row(page, 'Two')).toBeFocused();
  // Kept for the folder, on this device: another list and back, and it's still on.
  await page.locator('.tree-row__name[data-key="all"]').click();
  await expect(toggle(page)).toHaveCount(0);
  await fic(page);
  await expect(titles(page)).toHaveText(['Own', 'Three', 'Four', 'Five', 'One', 'Two']);
  // Off: the list as it was.
  await page.locator('.list').hover();
  await toggle(page).click();
  await expect(titles(page)).toHaveText(['Own']);
  await expect(page.locator('.list .list__count')).toHaveText('1 note');
});

test('a search in the list finds the subfolders’ notes too, in their groups', async ({ page }) => {
  await includeSubfolders(page);
  await page.locator('.list__search').getByRole('searchbox').fill('lake');
  await expect(titles(page)).toHaveText(['Three', 'Five']);
  await expect(heads(page)).toHaveText(['Arc 2', 'Arc 2 / Cut']);
});

test('⌥↓ moves a note within its group, in that folder’s order', async ({ page, vault }) => {
  await includeSubfolders(page);
  await row(page, 'Three').focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(titles(page)).toHaveText(['Own', 'Four', 'Three', 'Five', 'One', 'Two']);
  await expect.poll(() => notesOrder(vault, 'Fic/Arc 2')).toEqual(['Four.md', 'Three.md']);
  // At its group's foot it stays: the next group is another folder.
  await row(page, 'Three').focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(titles(page)).toHaveText(['Own', 'Four', 'Three', 'Five', 'One', 'Two']);
});

test('a drag within a group places the note there', ALONE, async ({ page, vault }) => {
  await includeSubfolders(page);
  await dragOnto(page, 'Two', 'One');
  await expect(titles(page)).toHaveText(['Own', 'Three', 'Four', 'Five', 'Two', 'One']);
  await expect.poll(() => notesOrder(vault, 'Fic/Arc 1')).toEqual(['Two.md', 'One.md']);
});

test(
  'a drag into another group moves the note to that folder, placed where it was let go',
  ALONE,
  async ({ page, vault }) => {
    await includeSubfolders(page);
    await dragOnto(page, 'One', 'Four');
    await expect(titles(page)).toHaveText(['Own', 'Three', 'One', 'Four', 'Five', 'Two']);
    await expect.poll(() => existsSync(at(vault, 'Fic/Arc 2/One.md'))).toBe(true);
    expect(existsSync(at(vault, 'Fic/Arc 1/One.md'))).toBe(false);
    await expect
      .poll(() => notesOrder(vault, 'Fic/Arc 2'))
      .toEqual(['Three.md', 'One.md', 'Four.md']);
  },
);

test('with two panes, the tree lists each folder’s notes once, under its own folder', async ({
  page,
}) => {
  await includeSubfolders(page);
  await page.locator('.sidebar__foot [data-command="panes"][aria-pressed="false"]').click();
  await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
  const tree = page.locator('.sidebar');
  await expect(tree.locator('.tree-row__name[data-path="Fic/Own.md"]')).toHaveCount(1);
  // Arc 2 is shut: its notes aren't listed under Fic as well.
  await expect(tree.locator('.tree-row__name[data-path="Fic/Arc 2/Three.md"]')).toHaveCount(0);
});
