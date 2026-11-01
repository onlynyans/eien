// A light novel's full-page pictures in pages (#59): each chapter that's only
// a picture is one page, the picture on it, never a blank page before it.
// The shapes such books give them: Calibre's SVG frame, an empty paragraph or
// a line break above it, a picture in a paragraph.

import { devices, expect, type Page, test } from '@playwright/test';
import { page as chapterPage, handEpub, nav, opf, XHTML } from '../support/epub-parts';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

/** A picture taller than any page, as a light novel's are. */
const TALL =
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200"><rect width="800" height="1200" fill="#888"/></svg>';
const FRAME =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid meet"><image width="800" height="1200" xlink:href="images/tall.svg"/></svg>';
// The first holds words: the book's first chapter carries Eien's title page and imprint before it.
const CHAPTERS: Record<string, string> = {
  Prologue: '<h1>Prologue</h1><p>The words before the pictures.</p>',
  Framed: `<div class="svg_outer_wrapper">${FRAME}</div>`,
  'Under a space': `<p class="calibre1">&#160;</p>\n<div class="svg_outer_wrapper">${FRAME}</div>`,
  'Under a break': '<p><br/></p>\n<div><img src="images/tall.svg" alt=""/></div>',
  'In a paragraph': '<p class="calibre1"><img src="images/tall.svg" alt=""/></p>',
};
const NAMES = Object.keys(CHAPTERS);

const book = () =>
  handEpub('content.opf', [
    {
      name: 'content.opf',
      data: opf(
        '3.0',
        [
          { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
          ...NAMES.map((_, n) => ({ id: `c${n}`, href: `c${n}.xhtml`, type: XHTML })),
          { id: 'tall', href: 'images/tall.svg', type: 'image/svg+xml' },
        ],
        NAMES.map((_, n) => `c${n}`),
      ),
    },
    { name: 'nav.xhtml', data: nav(NAMES.map((name, n) => [name, `c${n}.xhtml`])) },
    ...NAMES.map((name, n) => ({
      name: `c${n}.xhtml`,
      data: chapterPage(name, CHAPTERS[name] ?? ''),
    })),
    { name: 'images/tall.svg', data: TALL },
  ]);

/** The chapter in sight: how many pages wide it's laid, and whether its picture is on the page in sight. */
const sight = (page: Page) =>
  page.evaluate(() => {
    const chapter = document.querySelector<HTMLElement>(
      '.epub-sheet:not([aria-hidden]) .epub-chapter',
    );
    const box = chapter?.parentElement;
    const picture = chapter?.querySelector('img');
    if (!chapter || !box || !picture) return null;
    const on = box.getBoundingClientRect();
    const at = picture.getBoundingClientRect();
    return {
      pages: Math.round(chapter.scrollWidth / box.clientWidth),
      inSight: at.height > 0 && at.left >= on.left - 1 && at.right <= on.right + 1,
    };
  });

for (const screen of [
  { width: 412, height: 839 },
  { width: 590, height: 706 },
]) {
  test(`a picture alone is a page of its own, ${screen.width}×${screen.height}`, async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => window.eien.settings.set('epub.view', 'pages'));
    await putBytesOutside(
      page,
      'Eien/Vault/Novels/Novel.epub',
      Buffer.from(book()).toString('base64'),
    );
    await page.setViewportSize(screen);
    await page.reload();
    const back = page.locator('.phone-bar__back');
    const row = page.locator('.tree-row--epub .tree-row__name', { hasText: 'Novel' });
    await expect
      .poll(async () => (await row.isVisible()) || (await back.isVisible()), { timeout: 10_000 })
      .toBe(true);
    if (!(await row.isVisible())) await back.click();
    await row.click();
    await expect(page.locator('.page__leaf--epub')).toHaveAttribute('data-view', 'pages');
    for (const name of NAMES.slice(1)) {
      await back.click();
      await page.locator('.contents-row', { hasText: name }).click();
      await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter img')).toHaveCount(1);
      await expect.poll(() => sight(page), { message: name }).toEqual({ pages: 1, inSight: true });
    }
  });
}
