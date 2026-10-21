// Backlog #12 on the real app: All Notes in your order (new notes at the top
// until they're placed, kept in .eien/order.json, following renames), and
// Arrange mode: rows drag only while arranging, the lens set aside.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ALONE, boxOf, expect, test } from './launch';

const at = (vault: string | null, path: string) => join(vault ?? '', ...path.split('/'));
const order = (vault: string | null): string[] => {
  const file = at(vault, '.eien/order.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as string[]) : [];
};
const titles = (page: Page) => page.locator('.list .note-row__title');
const allNotes = (page: Page) => page.locator('.tree-row__name[data-key="all"]').click();
const row = (page: Page, title: string) =>
  page
    .locator('.list .note-row')
    .filter({ has: page.locator('.note-row__title', { hasText: new RegExp(`^${title}$`) }) });

async function dragOnto(page: Page, from: string, to: string): Promise<void> {
  const a = await boxOf(row(page, from));
  const b = await boxOf(row(page, to));
  await page.mouse.move(a.x + 40, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 40, b.y + 3, { steps: 8 });
  await page.mouse.up();
}

test.describe('All Notes in your order', () => {
  test.use({
    vaultFiles: {
      'Fic/Old.md': 'Old.\n',
      'Ideas.md': 'Ideas.\n',
      'Thaw.md': 'Thaw.\n',
    },
  });

  test('⌥↓ places a note; the order is kept in the vault and follows a rename', async ({
    page,
    vault,
  }) => {
    await allNotes(page);
    const before = await titles(page).allTextContents();
    expect(before).toHaveLength(3);
    await row(page, before[0] as string).focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(titles(page)).toHaveText([before[1], before[0], before[2]] as string[]);
    await expect.poll(() => order(vault)).toHaveLength(3);
    // Renamed in its row, it keeps its place, and the file names it anew.
    await row(page, before[0] as string).focus();
    await page.keyboard.press('F2');
    await page.keyboard.type('Renamed');
    await page.keyboard.press('Enter');
    await expect(titles(page)).toHaveText([before[1], 'Renamed', before[2]] as string[]);
    await expect.poll(() => order(vault).some((path) => path.endsWith('Renamed.md'))).toBe(true);
  });

  test('a new note shows at the top until it’s placed', async ({ page, vault }) => {
    await allNotes(page);
    await row(page, 'Thaw').focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(() => order(vault)).toHaveLength(3);
    await page.getByRole('button', { name: 'New note' }).click();
    await allNotes(page);
    await expect(titles(page).first()).toHaveText('Untitled');
  });

  test('a drag places a note in All Notes', ALONE, async ({ page, vault }) => {
    await allNotes(page);
    const before = await titles(page).allTextContents();
    await dragOnto(page, before[2] as string, before[0] as string);
    await expect(titles(page)).toHaveText([before[2], before[0], before[1]] as string[]);
    await expect.poll(() => order(vault)).toHaveLength(3);
  });
});

test.describe('Arrange mode', () => {
  test.use({
    deviceFile: { settings: { 'lists.arranging': 'mode' } },
    vaultFiles: {
      'Fic/A.md': 'A.\n',
      'Fic/B.md': 'B.\n',
      'Fic/C.md': 'C.\n',
      'Fic/.eien-folder.json': JSON.stringify({ order: ['A.md', 'B.md', 'C.md'] }),
      'Other/x.md': 'x\n',
    },
  });

  const fic = (page: Page) => page.locator('.tree-row__name[data-key="folder:Fic"]').click();
  const arrange = (page: Page) => page.locator('.list [data-key="lens-arrange:list"]');

  test(
    'rows don’t drag until Arrange; arranging sets the lens aside, and Done brings it back',
    ALONE,
    async ({ page, vault }) => {
      await fic(page);
      await expect(titles(page)).toHaveText(['A', 'B', 'C']);
      await expect(page.locator('.list__locked')).toHaveText(
        'Your order. Choose Arrange to move notes.',
      );
      await dragOnto(page, 'C', 'A');
      await page.waitForTimeout(500);
      await expect(titles(page)).toHaveText(['A', 'B', 'C']);
      // A sort laid over the list waits while arranging.
      await page.locator('.list').hover();
      await page.locator('.list [data-key="lens-sort:list"]').click();
      await page.getByRole('menuitemradio', { name: 'Title' }).click();
      await page.locator('.list .list__lens .chip').getByRole('button').waitFor();
      await arrange(page).click();
      await expect(arrange(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.list .list__lens')).toHaveCount(0);
      await expect(page.locator('.note-row__grip')).toHaveCount(3);
      await dragOnto(page, 'C', 'A');
      await expect(titles(page)).toHaveText(['C', 'A', 'B']);
      expect(
        (
          JSON.parse(readFileSync(at(vault, 'Fic/.eien-folder.json'), 'utf8')) as {
            order: string[];
          }
        ).order,
      ).toEqual(['C.md', 'A.md', 'B.md']);
      await arrange(page).click(); // Done
      await expect(page.locator('.list .list__lens .chip')).toHaveText(['Title']);
      await expect(page.locator('.note-row__grip')).toHaveCount(0);
    },
  );

  test('⌥↓ still moves a row: a key is on purpose', async ({ page }) => {
    await fic(page);
    await row(page, 'A').focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(titles(page)).toHaveText(['B', 'A', 'C']);
  });

  test(
    'folders don’t drag in the tree: their keys and menus move them',
    ALONE,
    async ({ page, vault }) => {
      const box = async (path: string) =>
        boxOf(page.locator(`.tree-row__name[data-key="folder:${path}"]`));
      const a = await box('Other');
      const b = await box('Fic');
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      expect(existsSync(at(vault, 'Other/x.md'))).toBe(true);
    },
  );
});
