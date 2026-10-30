// A hand's turn (#40, Phase 3c): a page in pages taken at the book's edge
// and drawn across, the curl following the hand; let go past a quarter of
// the page it turns, short of it slowly it falls back; under Words a drag
// asks for the turn. Drags with the pointer, so ALONE.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ALONE, expect, ROOT, test } from './launch';

const epub = (name: string) =>
  new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/epub', name)));

const leaf = (page: Page) => page.locator('.page__leaf--epub');
const box = (page: Page) => leaf(page).locator('.epub-sheet:not([aria-hidden]) .epub__pages');

/** The first words on the page in sight. */
const firstWords = (page: Page) =>
  box(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const at = document.caretRangeFromPoint(rect.left + 2, rect.top + 4);
    const node = at?.startContainer;
    return node?.textContent?.slice(at?.startOffset ?? 0, (at?.startOffset ?? 0) + 30) ?? '';
  });

/** The pointer down on the next page's edge, drawn `across` (of the sheet's width) leftward over `steps`, and let go. */
async function drawAcross(page: Page, across: number, steps: number) {
  const edge = await leaf(page).getByRole('button', { name: 'Next page' }).boundingBox();
  const sheet = await leaf(page).locator('.epub-sheet:not([aria-hidden])').boundingBox();
  if (!edge || !sheet) throw new Error('no page');
  const y = edge.y + edge.height * 0.8;
  await page.mouse.move(edge.x + edge.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(edge.x - sheet.width * across, y, { steps });
  await page.mouse.up();
}

async function open(page: Page) {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page
    .locator('.tree-row--epub .tree-row__name')
    .filter({ hasText: 'Pride and Prejudice' })
    .click();
  await expect(box(page)).toContainText('It is a truth universally acknowledged');
}

test.describe('a hand’s turn under Curl', () => {
  test.use({
    vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') },
    deviceFile: { settings: { 'epub.view': 'pages', 'epub.turn': 'curl', 'epub.turnSpeed': '1' } },
  });

  test(
    'drawn across and let go, the page turns; drawn a little and let go slowly, it falls back',
    ALONE,
    async ({ page }) => {
      await open(page);
      const first = await firstWords(page);
      // A little way, slowly: short of a quarter, it falls back.
      await drawAcross(page, 0.15, 30);
      await expect(page.locator('.turn-curl')).toHaveCount(0);
      expect(await firstWords(page)).toBe(first);
      // Most of the way: it turns.
      await drawAcross(page, 0.9, 12);
      await expect(page.locator('.turn-curl')).toHaveCount(0);
      await expect.poll(() => firstWords(page)).not.toBe(first);
    },
  );

  test(
    'a drag that falls back over the edge it began on is never also its click',
    ALONE,
    async ({ page }) => {
      await open(page);
      const first = await firstWords(page);
      const edge = await leaf(page).getByRole('button', { name: 'Next page' }).boundingBox();
      if (!edge) throw new Error('no edge');
      const [x, y] = [edge.x + edge.width / 2, edge.y + edge.height * 0.8];
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - 200, y, { steps: 8 });
      await page.mouse.move(x, y, { steps: 20 });
      await page.mouse.up();
      await expect(page.locator('.turn-curl')).toHaveCount(0);
      expect(await firstWords(page)).toBe(first);
    },
  );

  test('held, the curl is under the hand', ALONE, async ({ page }) => {
    await open(page);
    const edge = await leaf(page).getByRole('button', { name: 'Next page' }).boundingBox();
    if (!edge) throw new Error('no edge');
    await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(edge.x - 200, edge.y + edge.height * 0.8, { steps: 8 });
    await expect(page.locator('.turn-curl')).toHaveCount(1);
    await expect(page.locator('.turn-curl__strip').first()).toHaveCSS('transform', /matrix/u);
    await page.mouse.up();
    await expect(page.locator('.turn-curl')).toHaveCount(0);
  });
});

test.describe('a page caught in flight', () => {
  test.use({
    vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') },
    deviceFile: { settings: { 'epub.view': 'pages', 'epub.turn': 'curl', 'epub.turnSpeed': '4' } },
  });

  test('tapped, flies on; caught and drawn back, falls back', ALONE, async ({ page }) => {
    await open(page);
    const first = await firstWords(page);
    const sheet = await leaf(page).locator('.epub-sheet:not([aria-hidden])').boundingBox();
    if (!sheet) throw new Error('no sheet');
    const [x, y] = [sheet.x + sheet.width * 0.3, sheet.y + sheet.height * 0.5];
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.turn-curl')).toHaveCount(1);
    // A tap on it: it flies on, and lands.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('.turn-curl')).toHaveCount(0);
    const second = await firstWords(page);
    expect(second).not.toBe(first);
    // Caught and drawn back past where it started: it falls back to the page it left.
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.turn-curl')).toHaveCount(1);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + sheet.width * 0.6, y, { steps: 20 });
    await page.mouse.up();
    await expect(page.locator('.turn-curl')).toHaveCount(0);
    expect(await firstWords(page)).toBe(second);
  });
});

test.describe('a hand’s turn under Words', () => {
  test.use({
    vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') },
    deviceFile: { settings: { 'epub.view': 'pages', 'epub.turn': 'words', 'epub.turnSpeed': '1' } },
  });

  test('a drag asks for the turn, and holds nothing', ALONE, async ({ page }) => {
    await open(page);
    const first = await firstWords(page);
    await drawAcross(page, 0.1, 4);
    await expect(page.locator('.turn-curl')).toHaveCount(0);
    await expect.poll(() => firstWords(page)).not.toBe(first);
  });
});
