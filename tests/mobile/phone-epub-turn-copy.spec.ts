// A turn's copy of the page laid exactly as the page in sight (#60): every
// line where it stood, so none steps up or down as the page turns. The copy
// is the same under every Page turn (./page-copy.ts); Words shows it still.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');

/** Each line's foot in `words`, from the book's box's top, of the lines in the box's sight. */
const lines = (page: Page, words: string) =>
  page.evaluate((selector) => {
    const box = document.querySelector('.epub-sheet:not([aria-hidden]) .epub__pages');
    const within = document.querySelector(selector);
    if (!box || !within) return null;
    const at = box.getBoundingClientRect();
    const feet = new Set<number>();
    const texts = document.createTreeWalker(within, NodeFilter.SHOW_TEXT);
    for (let text = texts.nextNode(); text; text = texts.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(text);
      for (const rect of range.getClientRects()) {
        if (rect.width < 1 || rect.right < at.left + 2 || rect.left > at.right - 2) continue;
        feet.add(Math.round(rect.bottom - at.top));
      }
    }
    return [...feet].sort((a, b) => a - b);
  }, words);

for (const textSize of [100, 120]) {
  test(`a turn’s copy lays every line where the page has it, text at ${textSize}%`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await open(page);
    await page.evaluate(async (size) => {
      await window.eien.settings.set('epub.view', 'pages');
      await window.eien.settings.set('epub.turn', 'words');
      await window.eien.settings.set('epub.turnSpeed', '4');
      await window.eien.settings.set('epub.appearance.textSize', size);
    }, textSize);
    await putBytesOutside(
      page,
      'Eien/Vault/Novels/Pride and Prejudice.epub',
      readFileSync(FIXTURE).toString('base64'),
    );
    await page.setViewportSize({ width: 590, height: 706 });
    await page.reload();
    const back = page.locator('.phone-bar__back');
    const row = page.locator('.tree-row--epub .tree-row__name');
    await expect
      .poll(async () => (await row.isVisible()) || (await back.isVisible()), { timeout: 10_000 })
      .toBe(true);
    if (!(await row.isVisible())) await back.click();
    await row.click();
    await expect(page.locator('.epub-chapter').first()).toContainText('It is a truth');
    // Set as a book: the first paragraph is a paragraph, no gap under it, the next indented after it.
    const [first, second] = await page
      .locator('.epub-sheet:not([aria-hidden]) .epub-chapter p')
      .evaluateAll((paras) =>
        paras.slice(0, 2).map((para) => {
          const style = getComputedStyle(para);
          return { gap: style.marginBottom, indent: style.textIndent };
        }),
      );
    expect(first).toEqual({ gap: '0px', indent: '0px' });
    expect(second?.indent).not.toBe('0px');
    const copy = page.locator('.turn-copy [data-turn-words]').first();
    for (let turn = 1; turn <= 6; turn++) {
      const inSight = await lines(page, '.epub-sheet:not([aria-hidden]) .epub-chapter');
      await page.keyboard.press('ArrowRight');
      await expect(copy).toBeAttached();
      expect(await lines(page, '.turn-copy [data-turn-words]'), `turn ${turn}`).toEqual(inSight);
      await expect(copy).not.toBeAttached({ timeout: 10_000 });
    }
  });
}
