// A light novel's full-page pictures in pages (#59): each chapter that's only
// a picture is one page, the picture on it, never a blank page before it.
// The shapes such books give them: Calibre's SVG frame, an empty paragraph or
// a line break above it, a picture in a paragraph.

import { devices, expect, type Page, test } from '@playwright/test';
import { page as chapterPage, handEpub, nav, opf, XHTML } from '../support/epub-parts';
import { png } from '../support/images';
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
/** A colour page as a light novel's come: a raster picture, taller than any page. */
const PLATE = png(800, 1200);

const book = (chapters = CHAPTERS) => {
  const names = Object.keys(chapters);
  return handEpub('content.opf', [
    {
      name: 'content.opf',
      data: opf(
        '3.0',
        [
          { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
          ...names.map((_, n) => ({ id: `c${n}`, href: `c${n}.xhtml`, type: XHTML })),
          { id: 'tall', href: 'images/tall.svg', type: 'image/svg+xml' },
          { id: 'plate', href: 'images/plate.png', type: 'image/png' },
        ],
        names.map((_, n) => `c${n}`),
      ),
    },
    { name: 'nav.xhtml', data: nav(names.map((name, n) => [name, `c${n}.xhtml`])) },
    ...names.map((name, n) => ({
      name: `c${n}.xhtml`,
      data: chapterPage(name, chapters[name] ?? ''),
    })),
    { name: 'images/tall.svg', data: TALL },
    { name: 'images/plate.png', data: PLATE },
  ]);
};

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

/** The book in pages on `screen`, open at its first chapter; the back bar to its contents. */
async function openNovel(page: Page, bytes: Uint8Array, screen: { width: number; height: number }) {
  await open(page);
  await page.evaluate(() => window.eien.settings.set('epub.view', 'pages'));
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Novel.epub',
    Buffer.from(bytes).toString('base64'),
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
  return back;
}

for (const screen of [
  { width: 412, height: 839 },
  { width: 590, height: 706 },
]) {
  test(`a picture alone is a page of its own, ${screen.width}×${screen.height}`, async ({
    page,
  }) => {
    const back = await openNovel(page, book(), screen);
    for (const name of NAMES.slice(1)) {
      await back.click();
      await page.locator('.contents-row', { hasText: name }).click();
      await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter img')).toHaveCount(1);
      await expect.poll(() => sight(page), { message: name }).toEqual({ pages: 1, inSight: true });
    }
  });
}

/** How many pages wide the chapter in sight is laid, and which of its pictures are on the page in sight. */
const pictures = (page: Page) =>
  page.evaluate(() => {
    const chapter = document.querySelector<HTMLElement>(
      '.epub-sheet:not([aria-hidden]) .epub-chapter',
    );
    const box = chapter?.parentElement;
    if (!chapter || !box) return null;
    const on = box.getBoundingClientRect();
    return {
      pages: Math.round(chapter.scrollWidth / box.clientWidth),
      inSight: [...chapter.querySelectorAll('img')].map((picture) => {
        const at = picture.getBoundingClientRect();
        return at.height > 0 && at.left >= on.left - 1 && at.right <= on.right + 1;
      }),
    };
  });

test('a chapter of two pictures is two pages, a picture on each, no blank page before either', async ({
  page,
}) => {
  // Two plates as a light novel's colour pages come: blank lines above, between and after.
  const back = await openNovel(
    page,
    book({
      Prologue: CHAPTERS.Prologue ?? '',
      'Colour pages': `<p>&#160;</p><div><img src="images/plate.png" alt=""/></div><p><br/></p><p class="calibre1">&#160;</p><div class="svg_outer_wrapper">${FRAME.replace('tall.svg', 'plate.png')}</div><p>&#160;</p>`,
    }),
    { width: 590, height: 706 },
  );
  await back.click();
  await page.locator('.contents-row', { hasText: 'Colour pages' }).click();
  await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter img')).toHaveCount(2);
  await expect.poll(() => pictures(page)).toEqual({ pages: 2, inSight: [true, false] });
  // The keys turn the page they're in.
  await page.locator('.page__leaf--epub .page__scroll').first().focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => pictures(page)).toEqual({ pages: 2, inSight: [false, true] });
});

test('a chapter of SVG pictures turns one picture a page, forwards and back', async ({ page }) => {
  // An SVG's size isn't read from its header, as a PNG's is: the picture takes it only once
  // decoded, after the chapter is first laid in pages.
  const back = await openNovel(
    page,
    book({
      Prologue: CHAPTERS.Prologue ?? '',
      Plates: '<div><img src="images/tall.svg" alt=""/></div>'.repeat(3),
    }),
    { width: 590, height: 706 },
  );
  await back.click();
  await page.locator('.contents-row', { hasText: 'Plates' }).click();
  await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter img')).toHaveCount(3);
  await expect.poll(() => pictures(page)).toEqual({ pages: 3, inSight: [true, false, false] });
  await page.locator('.page__leaf--epub .page__scroll').first().focus();
  for (const [key, inSight] of [
    ['ArrowRight', [false, true, false]],
    ['ArrowRight', [false, false, true]],
    ['ArrowLeft', [false, true, false]],
    ['ArrowLeft', [true, false, false]],
  ] as const) {
    await page.keyboard.press(key);
    await expect.poll(() => pictures(page), { message: key }).toEqual({ pages: 3, inSight });
  }
});
