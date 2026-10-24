// Live on the real app (spec §4): a table is drawn in place, its cells
// formatted and editable; and "Show Markdown marks" off keeps the marks
// hidden on the caret's line too, from Settings or the View menu.

import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, editorContent, expect, readQuietly, test } from './launch';

const TABLE = '| **Project** | Due |\n|---|---|\n| Mara | 30 |\n';

test.use({
  vaultFiles: {
    'Table.md': `First paragraph.\n\n${TABLE}\nLast paragraph with **bold** words.\n`,
  },
});

/** '' while the file can't be read, so a poll tries again (./launch.ts). */
const readIn = (vault: string | null, path: string) => readQuietly(join(vault ?? '', path));
const checked = (app: ElectronApplication, id: string) =>
  app.evaluate(({ Menu }, id) => Menu.getApplicationMenu()?.getMenuItemById(id)?.checked, id);

async function open(page: Page): Promise<void> {
  await page.locator('.note-row', { hasText: 'Table' }).click();
  await expect(page.locator('.title')).toHaveText('Table');
}

const cell = (page: Page, words: string) =>
  editorContent(page).locator('.eien-cell', { hasText: words });

test('a table shows its cells formatted, in columns, the Markdown out of sight', async ({
  page,
}) => {
  await open(page);
  await page.locator('.cm-line', { hasText: 'First paragraph.' }).click();
  await expect(editorContent(page).locator('.eien-table-row')).toHaveCount(2); // the delimiter row hidden
  await expect(cell(page, 'Project')).toHaveText(' Project ');
  // Columns line up: the cells under one another start where the header's do.
  const head = await cell(page, 'Project').boundingBox();
  const body = await cell(page, 'Mara').boundingBox();
  expect(Math.abs((head?.x ?? 0) - (body?.x ?? 1))).toBeLessThan(1);
  expect(Math.abs((head?.width ?? 0) - (body?.width ?? 1))).toBeLessThan(1);
});

test('clicking a cell puts the caret in it, and typing edits the table’s Markdown', async ({
  page,
  vault,
}) => {
  await open(page);
  await cell(page, '30').click();
  await page.keyboard.type('5');
  // In the cell clicked, wherever in it the click put the caret; the row keeps its pipes.
  await expect
    .poll(() => readIn(vault, 'Table.md'), { timeout: 5000 })
    .toMatch(/^\| Mara \|(?=[^|\n]*5)[ 035]+\|$/mu);
  // Still a GFM table, the rest as it was.
  expect(readIn(vault, 'Table.md')).toContain('| **Project** | Due |\n|---|---|\n');
});

test.describe('with the marks hidden', () => {
  test('the caret’s line keeps them hidden, and the View menu brings them back', async ({
    app,
    page,
  }) => {
    await open(page);
    const line = page.locator('.cm-line', { hasText: 'Last paragraph' });
    await line.click();
    await expect(line).toContainText('**bold**'); // shown: Live as it always was
    expect(await checked(app, 'editor.marks')).toBe(true);
    await clickMenu(app, 'View', 'Show Markdown Marks');
    await expect.poll(() => checked(app, 'editor.marks')).toBe(false);
    await expect(line).toHaveText('Last paragraph with bold words.');
    // Typing stays where it was put, between the hidden marks.
    await page.keyboard.press('End');
    await page.keyboard.type(' More.');
    await expect(line).toHaveText('Last paragraph with bold words. More.');
    await clickMenu(app, 'View', 'Show Markdown Marks');
    await expect(line).toContainText('**bold**');
  });
});
