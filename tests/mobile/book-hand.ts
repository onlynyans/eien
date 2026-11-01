// A book in pages on the phone, and a finger on it: what the specs of a
// hand on the page share (./phone-hand.spec.ts, ./curl-layers.spec.ts,
// ./phone-choosing.spec.ts).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type CDPSession, expect, type Page } from '@playwright/test';
import { open, putBytesOutside } from './outside';

export const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');
export const back = (page: Page) => page.locator('.phone-bar__back');
export const box = (page: Page) => page.locator('.epub-sheet:not([aria-hidden]) .epub__pages');

/** The first words on the page in sight. */
export const firstWords = (page: Page) =>
  box(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const at = document.caretRangeFromPoint(rect.left + 2, rect.top + 4);
    return at?.startContainer.textContent?.slice(at.startOffset, at.startOffset + 30) ?? '';
  });

/** A book open in pages on the phone. */
export async function bookInPages(page: Page): Promise<void> {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await back(page).click();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await page.locator('.phone-bar__controls [data-command="look"]').click();
  await page.locator('[data-setting="epub.view"] [data-value="pages"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.page__leaf--epub')).toHaveAttribute('data-view', 'pages');
}

/** One finger's touch at (x, y), for CDP's Input.dispatchTouchEvent. */
export const touchAt = (x: number, y: number) => [
  { x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 },
];

/**
 * A finger held still in the middle of `area` (the page in sight, by default)
 * while the system's long press chooses the word under it, then lifted; the
 * words chosen. The touch is CDP's own, so the page's hand holds it as on a
 * phone; the long press is played as Blink plays it on Android, a cancelable
 * `selectstart` at the finger and the word chosen only if nothing cancelled
 * it, since desktop Chromium's own long press chooses nothing on Linux (CI).
 */
export async function longPress(page: Page, cdp: CDPSession, area = box(page)): Promise<string> {
  const rect = await area.boundingBox();
  if (!rect) throw new Error('no page');
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 3;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchAt(x, y) });
  // Android's long press comes some 400 ms in, the finger still where it came down.
  await page.waitForTimeout(500);
  await page.evaluate(
    ([x, y]) => {
      const at = document.caretRangeFromPoint(x, y);
      const node = at?.startContainer;
      if (!at || !(node instanceof Text)) return;
      const start = new Event('selectstart', { bubbles: true, cancelable: true });
      node.dispatchEvent(start);
      if (start.defaultPrevented) return;
      const { data } = node;
      let from = at.startOffset;
      let to = at.startOffset;
      while (from > 0 && /\S/u.test(data[from - 1] ?? '')) from--;
      while (to < data.length && /\S/u.test(data[to] ?? '')) to++;
      document.getSelection()?.setBaseAndExtent(node, from, node, to);
    },
    [x, y] as const,
  );
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return page.evaluate(() => document.getSelection()?.toString() ?? '');
}
