// The table editor on the real app (spec §4, Tables): rows and columns added,
// removed and moved in Live, by key, by grip and by +, the file a plain GFM
// table throughout; a removal says ⌘Z puts it back, and it does.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ALONE, editorContent, expect, test } from './launch';

const TABLE = '| Who | When |\n|---|---|\n| Mara | 30 |\n| Levi | 41 |\n';
const NOTE = `Before.\n\n${TABLE}\nAfter.\n`;

test.use({ vaultFiles: { 'Table.md': NOTE } });

const MAC = process.platform === 'darwin';
const readIn = (vault: string | null) => readFileSync(join(vault ?? '', 'Table.md'), 'utf8');
const saved = (vault: string | null) => expect.poll(() => readIn(vault), { timeout: 5000 });
const cell = (page: Page, words: string) =>
  editorContent(page).locator('.eien-cell', { hasText: words });
const said = (page: Page) => page.locator('.colophon__said');

async function open(page: Page): Promise<void> {
  await page.locator('.note-row', { hasText: 'Table' }).click();
  await expect(page.locator('.title')).toHaveText('Table');
}

test('keys add a row and a column, remove them, and ⌘Z puts the words back', async ({
  page,
  vault,
}) => {
  await open(page);
  await cell(page, 'Mara').click();
  await page.keyboard.press('ControlOrMeta+Alt+ArrowDown');
  await page.keyboard.type('Hange');
  await page.keyboard.press('Tab');
  await page.keyboard.type('52');
  await saved(vault).toBe(
    'Before.\n\n| Who | When |\n|---|---|\n| Mara | 30 |\n| Hange | 52 |\n| Levi | 41 |\n\nAfter.\n',
  );

  await page.keyboard.press('ControlOrMeta+Alt+Backspace');
  await expect(said(page)).toHaveText(`Row 2 removed · ${MAC ? '⌘Z' : 'Ctrl+Z'} puts it back`);
  await saved(vault).toBe(NOTE);
  await page.keyboard.press('ControlOrMeta+z');
  await saved(vault).toContain('| Hange | 52 |');

  await cell(page, 'When').click();
  await page.keyboard.press('ControlOrMeta+Alt+ArrowRight');
  await page.keyboard.type('Where');
  await saved(vault).toContain('| Who | When | Where |\n|---|---| --- |\n| Mara | 30 |  |');
  await page.keyboard.press('ControlOrMeta+Alt+Shift+Backspace');
  await saved(vault).toContain('| Who | When |\n|---|---|\n| Mara | 30 |\n');
});

test('typing a | in a cell saves it escaped, and the table keeps its shape', async ({
  page,
  vault,
}) => {
  await open(page);
  await cell(page, 'When').click();
  await page.keyboard.press('Tab'); // to the next row's first cell, its words chosen
  await page.keyboard.type('Mara | Bo');
  await saved(vault).toContain('| Mara \\| Bo | 30 |');
});

test.describe('with the formatting bar', () => {
  test.use({ deviceFile: { settings: { 'editor.formatBar': 'on' } } });

  test('the Table button is pressed in a table, and opens its menus; a choice aligns', async ({
    page,
    vault,
  }) => {
    await open(page);
    const table = page.locator('[data-command="format.table"]').first();
    await cell(page, '30').click();
    await expect(table).toHaveAttribute('aria-pressed', 'true');
    await table.click();
    const menu = page.getByRole('menu', { name: 'Row 1 · When' });
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitemradio', { name: 'Align right' }).click();
    await saved(vault).toContain('|---|---:|');
    await expect(cell(page, '30')).toHaveCSS('text-align', 'right');
  });
});

test('a + on the line between two columns adds one there', async ({ page, vault }) => {
  await open(page);
  await cell(page, 'Mara').hover();
  const add = page.getByRole('button', { name: 'Add a column between Who and When' });
  await add.hover();
  await add.click();
  await saved(vault).toContain('| Who |  | When |\n|---| --- |---|\n| Mara |  | 30 |');
  await page.keyboard.press('ControlOrMeta+z');
  await saved(vault).toBe(NOTE);
});

test(
  'a row’s grip, dragged, moves the row; pressed, opens its menu',
  ALONE,
  async ({ page, vault }) => {
    await open(page);
    await cell(page, 'Mara').click();
    const grip = page.getByRole('button', { name: 'Row 1: menu, or drag to move' });
    await expect(grip).toBeVisible();
    const from = await grip.boundingBox();
    const below = await cell(page, 'Levi').boundingBox();
    if (!from || !below) throw new Error('not laid out');
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, below.y + below.height, { steps: 8 });
    await expect(page.locator('.eien-table-drop.is-on')).toHaveCount(1);
    await page.mouse.up();
    await saved(vault).toContain('| Levi | 41 |\n| Mara | 30 |\n');
    await expect(said(page)).toHaveText('Row 1 moved');
    await page.keyboard.press('ControlOrMeta+z');
    await saved(vault).toBe(NOTE);

    await cell(page, 'Mara').hover();
    await grip.click();
    await expect(page.getByRole('menu', { name: 'Row 1' })).toBeVisible();
    await expect(grip).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('menuitem', { name: 'Remove row' }).click();
    await saved(vault).not.toContain('Mara');
    await page.keyboard.press('ControlOrMeta+z');
    await saved(vault).toBe(NOTE);
  },
);
