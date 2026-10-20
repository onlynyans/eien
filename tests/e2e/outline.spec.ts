// Phase 9c on the real app (spec §4): View → Outline Cards lays a book's
// chapters out as index cards in the page's place — the open chapter's
// book, or the book chosen — in the book's order; a card opens its
// chapter, dragging one or Alt and an arrow puts it elsewhere in the book,
// and Esc gives the page back.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { boxOf, clickMenu, expect, test } from './launch';

test.use({
  vaultFiles: {
    'Loose.md': 'Not in a book.\n',
    'Scarf/.eien-folder.json': '{"order":["Tear.md","Mend.md","Fire.md"],"book":{}}',
    'Scarf/Tear.md': 'The scarf caught on the gate.\n',
    'Scarf/Mend.md': 'She mended it.\n',
    'Scarf/Fire.md': 'By the fire, slowly.\n',
  },
});

const cards = (page: Page) => page.locator('.board .card');
const titles = (page: Page) => page.locator('.board .card__title');
const order = (vault: string | null) =>
  (
    JSON.parse(readFileSync(join(vault ?? '', 'Scarf/.eien-folder.json'), 'utf8')) as {
      order: string[];
    }
  ).order;
const outline = (app: ElectronApplication) => clickMenu(app, 'View', 'Outline Cards');

async function openBook(page: Page): Promise<void> {
  await page.locator('.tree-row__label', { hasText: 'Scarf' }).click();
  await expect(page.locator('.note-row')).toHaveCount(3);
}

test('the open chapter’s book as cards, in its order; a card opens its chapter', async ({
  app,
  page,
}) => {
  await openBook(page);
  await page.locator('.note-row', { hasText: 'Mend' }).click();
  await outline(app);
  await expect(page.locator('.board h2')).toHaveText('Scarf · outline');
  await expect(titles(page)).toHaveText(['Tear', 'Mend', 'Fire']);
  await expect(page.locator('.board .card__number')).toHaveText(['i', 'ii', 'iii']);
  await expect(page.locator('.board .card__words')).toHaveText(['6 w', '3 w', '4 w']);
  await expect(cards(page).nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(cards(page).nth(1)).toBeFocused(); // the keyboard on the open chapter's card
  await expect(page.locator('.sheet')).toBeHidden();

  await cards(page).nth(2).click();
  await expect(page.locator('.board')).toBeHidden();
  await expect(page.locator('.title')).toHaveText('Fire');
});

test('Esc, or View → Outline Cards again, gives the page back', async ({ app, page }) => {
  await openBook(page);
  await outline(app); // no chapter open: the book chosen
  await expect(titles(page)).toHaveText(['Tear', 'Mend', 'Fire']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.board')).toBeHidden();
  await outline(app);
  await expect(page.locator('.board')).toBeVisible();
  await outline(app);
  await expect(page.locator('.board')).toBeHidden();
});

test('not a book: no cards, and a line saying why', async ({ app, page }) => {
  await page.locator('.note-row', { hasText: 'Loose' }).click();
  await outline(app);
  await expect(page.locator('.board')).toBeHidden();
  await expect(page.locator('.list__notice')).toHaveText(
    'Outline cards show a book: choose one, or open one of its chapters.',
  );
});

test('Alt and an arrow moves a card; the arrows move between cards', async ({
  app,
  page,
  vault,
}) => {
  await openBook(page);
  await outline(app);
  await expect(cards(page).first()).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(cards(page).nth(1)).toBeFocused();
  await page.keyboard.press('Alt+ArrowRight'); // Mend after Fire
  await expect(titles(page)).toHaveText(['Tear', 'Fire', 'Mend']);
  await expect.poll(() => order(vault)).toEqual(['Tear.md', 'Fire.md', 'Mend.md']);
  await expect(cards(page).nth(2)).toBeFocused(); // the keyboard went with the card
  await expect(page.locator('.board .card__number')).toHaveText(['i', 'ii', 'iii']);
});

test('dragging a card puts it before the card it’s dropped on', async ({ app, page, vault }) => {
  await openBook(page);
  await outline(app);
  const from = await boxOf(cards(page).nth(2)); // Fire
  const to = await boxOf(cards(page).first()); // Tear, its left half
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 10, to.y + to.height / 2, { steps: 8 });
  await expect(page.locator('.drop-marker--across')).toBeVisible();
  await page.mouse.up();
  await expect(titles(page)).toHaveText(['Fire', 'Tear', 'Mend']);
  await expect.poll(() => order(vault)).toEqual(['Fire.md', 'Tear.md', 'Mend.md']);
});
