// Backlog #12 on the real app: your order for folders and tags, written to
// the vault. A folder moves with ⌥ and the arrows (up, down, out of its
// folder, into the one above), from its menu, or by a drag; a tag moves with
// ⌥↑ ⌥↓. A folder's notes keep their order beside its folders'.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ALONE, boxOf, expect, test } from './launch';

test.use({
  vaultFiles: {
    'A/One.md': 'One. #alpha\n',
    'B/Two.md': 'Two. #beta\n',
    'Fic/Scarf/Three.md': 'Three. #gamma\n',
    'Fic/Wall/Four.md': 'Four.\n',
    'Fic/Second.md': 'Second.\n',
    'Fic/First.md': 'First.\n',
    'Fic/.eien-folder.json': JSON.stringify({ order: ['Second.md', 'First.md'] }),
  },
});

const read = (vault: string | null, path: string) =>
  JSON.parse(readFileSync(join(vault ?? '', ...path.split('/')), 'utf8')) as {
    order: string[];
  };
const folder = (page: Page, path: string) =>
  page.locator(`.tree-row__name[data-key="folder:${path}"]`);
/** The folders at one level of the tree, in the order shown. */
const level = (page: Page, under: string) =>
  page
    .locator(
      under === ''
        ? '#sidebar-folders > .tree-row > .tree-row__name[data-folder]'
        : `.tree-row__name[data-folder^="${under}/"]`,
    )
    .evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.folder));

test('⌥↓ and ⌥↑ move a folder among its own; the vault keeps the order, the keyboard stays', async ({
  page,
  vault,
}) => {
  await expect.poll(() => level(page, '')).toEqual(['A', 'B', 'Fic']);
  await folder(page, 'A').focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => level(page, '')).toEqual(['B', 'A', 'Fic']);
  await expect(folder(page, 'A')).toBeFocused();
  expect(read(vault, '.eien-folder.json').order).toEqual(['B', 'A', 'Fic']);
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(() => level(page, '')).toEqual(['A', 'B', 'Fic']);
});

test('a folder’s notes keep their order as its folders move', async ({ page, vault }) => {
  await folder(page, 'Fic').click(); // open, to show its folders
  await expect.poll(() => level(page, 'Fic')).toEqual(['Fic/Scarf', 'Fic/Wall']);
  await folder(page, 'Fic/Scarf').focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => level(page, 'Fic')).toEqual(['Fic/Wall', 'Fic/Scarf']);
  expect(read(vault, 'Fic/.eien-folder.json').order).toEqual([
    'Wall',
    'Scarf',
    'Second.md',
    'First.md',
  ]);
  await expect(page.locator('.list .note-row__title')).toHaveText(['Second', 'First']);
});

test('⌥← takes a folder out of its folder, to just after it; ⌥→ into the folder above', async ({
  page,
}) => {
  await folder(page, 'Fic').click();
  await folder(page, 'Fic/Wall').focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await expect.poll(() => level(page, '')).toEqual(['A', 'B', 'Fic', 'Wall']);
  await expect(folder(page, 'Wall')).toBeFocused();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(folder(page, 'Fic/Wall')).toBeFocused();
  await expect.poll(() => level(page, 'Fic')).toEqual(['Fic/Scarf', 'Fic/Wall']);
});

test('a folder’s menu moves it too: up, and out of the folder it’s in', async ({ page }) => {
  await folder(page, 'Fic').click();
  await folder(page, 'Fic/Wall').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Move up', exact: true }).click();
  await expect.poll(() => level(page, 'Fic')).toEqual(['Fic/Wall', 'Fic/Scarf']);
  await folder(page, 'Fic/Wall').click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Move up', exact: true })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Move out of Fic' }).click();
  await expect.poll(() => level(page, '')).toEqual(['A', 'B', 'Fic', 'Wall']);
});

test('⌥↓ moves a tag among the tags beside it, kept in the vault', async ({ page, vault }) => {
  const tags = () =>
    page
      .locator('.tree-row__name[data-key^="tag:"]')
      .evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.key));
  await expect.poll(tags).toEqual(['tag:alpha', 'tag:beta', 'tag:gamma']);
  await page.locator('.tree-row__name[data-key="tag:alpha"]').focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(tags).toEqual(['tag:beta', 'tag:alpha', 'tag:gamma']);
  await expect(page.locator('.tree-row__name[data-key="tag:alpha"]')).toBeFocused();
  expect(read(vault, '.eien/tags.json').order).toEqual(['beta', 'alpha', 'gamma']);
});

test.describe('dragging folders', () => {
  async function drag(
    page: Page,
    from: string,
    to: string,
    where: 'top' | 'middle',
  ): Promise<void> {
    const a = await boxOf(folder(page, from));
    const b = await boxOf(folder(page, to));
    const y = where === 'top' ? b.y + 2 : b.y + b.height / 2;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, y, { steps: 8 });
    await page.mouse.up();
  }

  test('onto a folder, it goes inside', ALONE, async ({ page, vault }) => {
    await drag(page, 'B', 'A', 'middle');
    await expect.poll(() => existsSync(join(vault ?? '', 'A', 'B', 'Two.md'))).toBe(true);
    expect(existsSync(join(vault ?? '', 'B'))).toBe(false);
  });

  test('to the top edge of another, it’s placed before it', ALONE, async ({ page }) => {
    await drag(page, 'Fic', 'A', 'top');
    await expect.poll(() => level(page, '')).toEqual(['Fic', 'A', 'B']);
  });
});
