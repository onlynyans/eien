// A book in pages at a page zoom (#40, Phase 3b): laid out anew between two
// turns, it keeps the page it was on, however far into the chapter. Each
// page's first word stands exactly at its page's edge, so a zoom measured a
// hair off (a rect rounded against a size) put a page laid out anew, from the
// fifteenth or so, a page early: a turn on and back lost one. Set as a book
// justifies where the window hyphenates (a Mac's Chromium does).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Locator, test } from '@playwright/test';
import { open, putBytesOutside } from './outside';

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');

/** The first words in sight on the page: what's at the box's top left. */
const firstWords = (box: Locator) =>
  box.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const at = document.caretRangeFromPoint(rect.left + 2, rect.top + 4);
    return at?.startContainer.textContent?.slice(at.startOffset, at.startOffset + 30) ?? '';
  });

test('a book at 150% keeps its page laid out anew between a turn on and back, deep in a chapter', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(async () => {
    await window.eien.settings.set('appearance.room', 'panes');
    await window.eien.settings.set('layout.panes', 'three');
    await window.eien.settings.set('epub.view', 'pages');
    await window.eien.settings.set('epub.turnSpeed', '0');
    await window.eien.settings.set('page.zoom', 150);
  });
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  // A width whose page is an odd number of pixels: drawn at 150%, a half pixel the rect rounds.
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.reload();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  const box = page.locator('.page__leaf--epub .epub-sheet:not([aria-hidden]) .epub__pages');
  await expect(box.locator('.epub-chapter')).toContainText('It is a truth universally');
  expect(await box.evaluate((element) => (element.clientWidth * 1.5) % 1)).toBe(0.5);
  await page.locator('.page__leaf--epub .page__scroll').focus();

  for (let turn = 0; turn < 24; turn++) {
    await page.keyboard.press('ArrowRight');
    const on = await firstWords(box);
    // Laid out anew, as a font that loads late lays it out.
    await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
    await expect.poll(() => firstWords(box), { message: `turn ${turn}` }).toBe(on);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => firstWords(box), { message: `turn ${turn}, back` }).toBe(on);
  }
  // Every turn in the first chapter: none of them its last page.
  await expect(box.locator('.epub-chapter')).toContainText('It is a truth universally');
  await page.keyboard.press('ArrowRight');
  await expect(box.locator('.epub-chapter')).toContainText('It is a truth universally');
});
