// A turn's copy of the page laid exactly as the page in sight (#60): every
// line where it stood, so none steps up or down as the page turns, whatever
// begins the page (a paragraph's middle or start, a scene break, an
// epigraph, a picture). The copy is the same under every Page turn (./page-copy.ts);
// Words shows it still.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import { page as chapterPage, handEpub, nav, opf, XHTML } from '../support/epub-parts';
import { png } from '../support/images';
import { open, openChapter, putBytesOutside } from './outside';

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

const LINE =
  'The rain kept on through the evening, and the lamps along the quay were lit before the boats came in, one by one, low in the water.';
/** A chapter whose pages begin on every kind of block: paragraphs, scene breaks, epigraphs. */
const PARTS = Array.from(
  { length: 30 },
  (_, n) =>
    `<p>${LINE.repeat(1 + (n % 3))}</p>\n<p>${LINE}</p>\n<hr class="transition"/>\n<blockquote epub:type="epigraph"><p>${LINE}</p></blockquote>`,
).join('\n');
const partsBook = () =>
  handEpub('content.opf', [
    {
      name: 'content.opf',
      data: opf(
        '3.0',
        [
          { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
          { id: 'c0', href: 'c0.xhtml', type: XHTML },
          { id: 'c1', href: 'c1.xhtml', type: XHTML },
        ],
        ['c0', 'c1'],
      ),
    },
    {
      name: 'nav.xhtml',
      data: nav([
        ['Opening', 'c0.xhtml'],
        ['The quay', 'c1.xhtml'],
      ]),
    },
    // The first chapter carries Eien's title page: the parts are the second's.
    { name: 'c0.xhtml', data: chapterPage('Opening', '<h1>Opening</h1><p>Before.</p>') },
    { name: 'c1.xhtml', data: chapterPage('The quay', `<h1>The quay</h1>${PARTS}`) },
  ]);

/**
 * A book in pages, turned by Words slowly enough to read its copy, at `textSize`, on `screen`, in
 * `room` (Panes unless said).
 */
async function openBook(
  page: Page,
  bytes: Uint8Array,
  screen: { width: number; height: number },
  textSize: number,
  room: 'panes' | 'one' = 'panes',
) {
  await open(page);
  await page.evaluate(
    async ([size, room]) => {
      await window.eien.settings.set('appearance.room', room);
      await window.eien.settings.set('epub.view', 'pages');
      // The contents beside the page in Panes (a phone starts with two panes, #69), read as it reloads.
      await window.eien.settings.set('layout.panes', 'three');
      await window.eien.settings.set('epub.turn', 'words');
      await window.eien.settings.set('epub.turnSpeed', '4');
      await window.eien.settings.set('epub.appearance.textSize', size);
    },
    [textSize, room] as const,
  );
  await putBytesOutside(page, 'Eien/Vault/Novels/Book.epub', Buffer.from(bytes).toString('base64'));
  await page.setViewportSize(screen);
  await page.reload();
  const back = page.locator('.phone-bar__back');
  const row = page.locator('.tree-row--epub .tree-row__name');
  await expect
    .poll(async () => (await row.isVisible()) || (await back.isVisible()), { timeout: 10_000 })
    .toBe(true);
  if (!(await row.isVisible())) await back.click();
  await row.click();
  await expect(page.locator('.page__leaf--epub')).toHaveAttribute('data-view', 'pages');
}

/** `turns` turns on, each copy's lines held to the page's as it was. */
async function turnsMatch(page: Page, turns: number) {
  const copy = page.locator('.turn-copy [data-turn-words]').first();
  // The keys turn the page they're in, not the list beside it.
  await page.locator('.page__leaf--epub .page__scroll').first().focus();
  for (let turn = 1; turn <= turns; turn++) {
    const inSight = await lines(page, '.epub-sheet:not([aria-hidden]) .epub-chapter');
    await page.keyboard.press('ArrowRight');
    await expect(copy).toBeAttached();
    expect(await lines(page, '.turn-copy [data-turn-words]'), `turn ${turn}`).toEqual(inSight);
    await expect(copy).not.toBeAttached({ timeout: 10_000 });
  }
}

const FOLD = { width: 590, height: 706 };

for (const textSize of [100, 120]) {
  test(`a turn’s copy lays every line where the page has it, text at ${textSize}%`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openBook(page, readFileSync(FIXTURE), FOLD, textSize);
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
    await turnsMatch(page, 6);
  });
}

for (const screen of [FOLD, { width: 1180, height: 820 }]) {
  test(`a page that begins on a scene break or an epigraph, its copy too, ${screen.width}px`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // A Fold's page whole, one at a time: the copy at the width these were found at (#60). On a page
    // under 300px (the Fold's beside the tree, #68) a copy still gains a line: a fix of its own.
    await openBook(page, partsBook(), screen, 100, screen === FOLD ? 'one' : 'panes');
    await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter')).toContainText(
      'Before.',
    );
    // The contents a step back, beside the page, or under the book on SHELF, as the room has them.
    await openChapter(page, 'The quay');
    await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter')).toContainText(
      'The rain kept on',
    );
    await turnsMatch(page, 14);
  });
}

/** Each picture's top and foot in `within`, from the book's box's top, of the pictures in the box's sight. */
const pictures = (page: Page, within: string) =>
  page.evaluate((selector) => {
    const box = document.querySelector('.epub-sheet:not([aria-hidden]) .epub__pages');
    const holder = document.querySelector(selector);
    if (!box || !holder) return null;
    const at = box.getBoundingClientRect();
    return [...holder.querySelectorAll('img')]
      .map((img) => img.getBoundingClientRect())
      .filter((rect) => rect.width > 1 && rect.right > at.left + 2 && rect.left < at.right - 2)
      .map((rect) => [Math.round(rect.top - at.top), Math.round(rect.bottom - at.top)]);
  }, within);

/** A chapter with a picture every few paragraphs, as an illustrated novel's: some page begins on one. */
const PLATES = Array.from(
  { length: 12 },
  (_, n) =>
    `<p>${LINE.repeat(1 + (n % 3))}</p>\n<p>${LINE}</p>\n<div class="illus"><img src="images/plate.png" alt=""/></div>`,
).join('\n');
const platesBook = () =>
  handEpub('content.opf', [
    {
      name: 'content.opf',
      data: opf(
        '3.0',
        [
          { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
          { id: 'c0', href: 'c0.xhtml', type: XHTML },
          { id: 'c1', href: 'c1.xhtml', type: XHTML },
          { id: 'plate', href: 'images/plate.png', type: 'image/png' },
        ],
        ['c0', 'c1'],
      ),
    },
    {
      name: 'nav.xhtml',
      data: nav([
        ['Opening', 'c0.xhtml'],
        ['The harbour', 'c1.xhtml'],
      ]),
    },
    { name: 'c0.xhtml', data: chapterPage('Opening', '<h1>Opening</h1><p>Before.</p>') },
    { name: 'c1.xhtml', data: chapterPage('The harbour', `<h1>The harbour</h1>${PLATES}`) },
    { name: 'images/plate.png', data: png(800, 560) },
  ]);

test('a page that begins on a picture: the copy lays the picture, and the lines under it, where the page has them', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openBook(page, platesBook(), FOLD, 100, 'one'); // a Fold's page whole, as above
  await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter')).toContainText(
    'Before.',
  );
  await openChapter(page, 'The harbour');
  const chapter = '.epub-sheet:not([aria-hidden]) .epub-chapter';
  const copied = '.turn-copy [data-turn-words]';
  await expect(page.locator(chapter)).toContainText('The rain kept on');
  const copy = page.locator(copied).first();
  await page.locator('.page__leaf--epub .page__scroll').first().focus();
  let headed = 0;
  for (let turn = 1; turn <= 6; turn++) {
    const inSight = { lines: await lines(page, chapter), pictures: await pictures(page, chapter) };
    await page.keyboard.press('ArrowRight');
    await expect(copy).toBeAttached();
    const inCopy = { lines: await lines(page, copied), pictures: await pictures(page, copied) };
    expect(inCopy, `turn ${turn}`).toEqual(inSight);
    // A picture at the page's head: above any line on it.
    const [top] = inSight.pictures?.[0] ?? [];
    if (top !== undefined && (inSight.lines ?? []).every((foot) => foot > top)) headed++;
    await expect(copy).not.toBeAttached({ timeout: 10_000 });
  }
  expect(headed, 'pages begun on a picture').toBeGreaterThan(0);
});
