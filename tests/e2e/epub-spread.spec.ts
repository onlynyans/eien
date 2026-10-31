// Two pages, and a book set as a book (#40, Phase 3d): the spread opens
// where the pane holds two pages of 20em and closes a pixel short of it,
// turning a spread at a time under each Page turn; the text justified where
// the window hyphenates, a chapter opening four lines low, running heads and
// folios, and Eien's title page and imprint before the first chapter; a
// bookmark's mark on the page it marks, and the edge strip beside a spread.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, expect, ROOT, test } from './launch';

const BOOK = new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/epub/plain.epub')));

const shelfBook = (page: Page) =>
  page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' });
const leaf = (page: Page) => page.locator('.page__leaf--epub');
/** The book's own sheet, never a turn's copy of it. */
const sheet = (page: Page) => leaf(page).locator('.epub-sheet:not([aria-hidden])');
const box = (page: Page) => sheet(page).locator('.epub__pages');
const chapter = (page: Page) => sheet(page).locator('.epub-chapter');
const scroller = (page: Page) => leaf(page).locator('.page__scroll');
const heads = (page: Page) => sheet(page).locator('.epub-heads__item');
const folios = (page: Page) => sheet(page).locator('.epub-folios__item');

/** How many pixels the pane is short of a spread (less than 0: past it), as spread.ts measures it. */
const shortOfSpread = (page: Page) =>
  leaf(page).evaluate((element) => {
    const px = (value: string) => Number.parseFloat(value) || 0;
    const room = element.querySelector('.page__scroll') as HTMLElement;
    const pages = element.querySelector(
      '.epub-sheet:not([aria-hidden]) .epub__pages',
    ) as HTMLElement;
    const words = pages.querySelector('.epub-chapter') as HTMLElement;
    const paper = pages.closest('.sheet') as HTMLElement;
    const pane = getComputedStyle(room);
    const share = Math.min(1, px(getComputedStyle(paper).getPropertyValue('--look-width')) || 1);
    const width = (room.clientWidth - px(pane.paddingLeft) - px(pane.paddingRight)) * share;
    const zoom = pages.getBoundingClientRect().width / pages.clientWidth || 1;
    const need =
      2 * 20 * px(getComputedStyle(words).fontSize) +
      2 * px(getComputedStyle(paper).paddingLeft) +
      px(getComputedStyle(pages).columnGap);
    return need * zoom - width;
  });

/** The window sized `by` pixels past the spread's threshold (less than 0: short of it). */
async function pastSpread(page: Page, by: number): Promise<void> {
  const size = page.viewportSize() ?? { width: 1400, height: 900 };
  const short = await shortOfSpread(page);
  await page.setViewportSize({ width: Math.round(size.width + short + by), height: size.height });
}

/** The words at the top left of each page in sight. */
const pageTops = (page: Page) =>
  box(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const two = element.hasAttribute('data-spread');
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
    const page = two ? (rect.width - gap) / 2 : rect.width;
    const lefts = two ? [rect.left, rect.left + page + gap] : [rect.left];
    return lefts.map((left) => {
      // The first line's words: past an opening's sink, the first text found going down.
      for (let y = rect.top + 4; y < rect.bottom; y += 6) {
        const at = document.caretRangeFromPoint(left + 2, y);
        const text = at?.startContainer.textContent?.slice(at.startOffset, at.startOffset + 24);
        if (at?.startContainer.nodeType === Node.TEXT_NODE && text?.trim()) return text;
      }
      return '';
    });
  });

/**
 * Whether the part of the sheet `selector` names stands in the pages in sight.
 * A page turned away is still laid out beside them (only clipped), so
 * Playwright's own visibility would call it visible.
 */
const inSight = (page: Page, selector: string) =>
  box(page).evaluate((element, part) => {
    const found = element.querySelector(part);
    if (!found) return false;
    const rect = found.getBoundingClientRect();
    const sight = element.getBoundingClientRect();
    return rect.width > 0 && rect.left >= sight.left - 1 && rect.right <= sight.right + 1;
  }, selector);

async function opened(page: Page, app: ElectronApplication): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 900 });
  await shelfBook(page).click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  // The list shut: the pane's room is the sidebar's and the page's.
  await clickMenu(app, 'View', 'Toggle Note List');
  await expect(page.locator('.list')).toBeHidden();
  await scroller(page).focus();
}

test.use({
  vaultFiles: { 'Novels/Pride and Prejudice.epub': BOOK },
  deviceFile: { settings: { 'epub.view': 'pages', 'epub.turnSpeed': '0' } },
});

test.describe('two pages', () => {
  test('open where the pane holds two of 20em, and close a few pixels short, the place in sight', async ({
    page,
    app,
  }) => {
    await opened(page, app);
    await pastSpread(page, -8);
    await expect(box(page)).not.toHaveAttribute('data-spread');
    await page.keyboard.press('ArrowRight');
    const [top] = await pageTops(page);
    expect(top).toBeTruthy();
    await pastSpread(page, 8);
    await expect(box(page)).toHaveAttribute('data-spread', '');
    expect(await chapter(page).evaluate((element) => getComputedStyle(element).columnCount)).toBe(
      '2',
    );
    // The page in sight before is one of the two in sight now.
    await expect.poll(() => pageTops(page)).toContain(top);
    // The gutter: a soft hairline down the middle of the gap.
    const gutter = await box(page).evaluate((element) => {
      const after = getComputedStyle(element, '::after');
      return { width: after.width, left: after.left, content: after.content };
    });
    expect(gutter.content).toBe('""');
    expect(gutter.width).toBe('1px');
    // Short of it again: one page, the same words.
    await pastSpread(page, -8);
    await expect(box(page)).not.toHaveAttribute('data-spread');
    await expect.poll(async () => (await pageTops(page))[0]).toBe(top);
  });

  test('turn a spread at a time, by key and by the edges, and say both pages', async ({
    page,
    app,
  }) => {
    await opened(page, app);
    await pastSpread(page, 40);
    await expect(box(page)).toHaveAttribute('data-spread', '');
    const next = leaf(page).getByRole('button', { name: 'Next pages' });
    await expect(next).toHaveAttribute('data-tip', /Next pages · \d+ pages? on in the chapter/u);
    const first = await pageTops(page);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => pageTops(page)).not.toEqual(first);
    const second = await pageTops(page);
    // Neither of the spread before is in sight: a turn moves both pages.
    for (const words of first) expect(second).not.toContain(words);
    await next.click();
    await expect.poll(() => pageTops(page)).not.toEqual(second);
    await leaf(page).getByRole('button', { name: 'Previous pages' }).click();
    await expect.poll(() => pageTops(page)).toEqual(second);
    // Counted, the colophon says the spread's two pages.
    await expect(page.locator('.colophon__page').first()).toHaveText(/^pages? \d+(–\d+)? of \d+$/u);
  });

  for (const turn of ['curl', 'slide', 'words'] as const) {
    test.describe(turn, () => {
      test.use({
        deviceFile: {
          settings: { 'epub.view': 'pages', 'epub.turn': turn, 'epub.turnSpeed': '1' },
        },
      });

      test(`turns a spread under ${turn}, the copy gone once it lands`, async ({ page, app }) => {
        await opened(page, app);
        await pastSpread(page, 40);
        await expect(box(page)).toHaveAttribute('data-spread', '');
        const first = await pageTops(page);
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.turn-curl, .turn-copy')).toHaveCount(0);
        await expect.poll(() => pageTops(page)).not.toEqual(first);
        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('.turn-curl, .turn-copy')).toHaveCount(0);
        await expect.poll(() => pageTops(page)).toEqual(first);
      });
    });
  }

  test('wear a bookmark on the page it marks, and keep it there', async ({ page, app, vault }) => {
    if (!vault) throw new Error('no vault');
    await opened(page, app);
    await pastSpread(page, 40);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('b');
    // The spread's first word is the verso's: its mark at the left, the recto's none.
    const left = leaf(page).locator('.page__mark--bookmark[data-edge="left"]');
    const right = leaf(page).locator('.page__mark--bookmark[data-edge="right"]');
    await expect(left).toBeVisible();
    await expect(right).toBeHidden();
    const reading = join(vault, '.eien/reading');
    await expect.poll(() => (existsSync(reading) ? readdirSync(reading).length : 0)).toBe(1);
    // Over the verso's outer half.
    const [mark, paper] = await Promise.all([left.boundingBox(), sheet(page).boundingBox()]);
    if (!mark || !paper) throw new Error('no mark or sheet');
    expect(mark.x + mark.width / 2).toBeLessThan(paper.x + paper.width / 2);
    await page.keyboard.press('ArrowRight');
    await expect(left).toBeHidden();
    await page.keyboard.press('ArrowLeft');
    await expect(left).toBeVisible();
  });
});

test.describe('set as a book', () => {
  test('justified where the window hyphenates, a chapter opening four lines low, heads and folios', async ({
    page,
    app,
  }) => {
    await opened(page, app);
    await pastSpread(page, 40);
    const set = await chapter(page).evaluate((element) => {
      const paragraph = element.querySelector('p:not([data-part])') as HTMLElement;
      const title = element.querySelector('[data-part="chapter-title"]') as HTMLElement;
      const style = getComputedStyle(element);
      return {
        hyphens: style.hyphens,
        align: getComputedStyle(paragraph).textAlign,
        sink: Number.parseFloat(getComputedStyle(title).paddingTop),
        line: Number.parseFloat(style.lineHeight),
        hyphenates: element.closest('.page__leaf')?.hasAttribute('data-hyphens'),
      };
    });
    expect(set.hyphens).toBe('auto');
    // Justified only where words break at a hyphen (a Mac's dictionaries; maybe none elsewhere).
    expect(set.align).toBe(set.hyphenates ? 'justify' : 'start');
    expect(set.sink).toBeCloseTo(4 * set.line, 0);
    // The opening leaves its head off; the recto has the chapter's.
    await expect(heads(page).nth(0)).toHaveText('');
    await expect(heads(page).nth(1)).toHaveText('Chapter I');
    await page.keyboard.press('ArrowRight');
    await expect(heads(page).nth(0)).toHaveText('Pride and Prejudice');
    // Once the book's counted, each page's number at its outer corner.
    await expect(folios(page).nth(0)).toHaveText(/^\d+$/u);
  });

  test('turns back to Eien’s title page and imprint before the first chapter, never opened at', async ({
    page,
    app,
  }) => {
    await opened(page, app);
    await pastSpread(page, 40);
    // Back from Chapter I, through the book's own first page, to Eien's. QA (#40, Phase 3d): in
    // sight, not merely drawn: the book's first item holds the front matter on every page of it.
    const title = sheet(page).locator('[aria-label="Title page"]');
    for (let i = 0; i < 6 && !(await inSight(page, '[aria-label="Title page"]')); i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(100);
    }
    await expect.poll(() => inSight(page, '[aria-label="Title page"]')).toBe(true);
    await expect(title).toContainText('Pride and Prejudice');
    const imprint = sheet(page).locator('[aria-label="Imprint"]');
    // Facing it on the spread's recto.
    await expect.poll(() => inSight(page, '[aria-label="Imprint"]')).toBe(true);
    await expect(imprint).toContainText('Set in Newsreader at');
    await expect(imprint).toContainText('a page,');
    // No page of the book's, so no number and no heads.
    await expect(page.locator('.colophon__page').first()).toHaveText('');
    await expect(folios(page).nth(0)).toHaveText('');
    // Home goes to the chapter's opening, never the front matter.
    await page.keyboard.press('Home');
    await expect.poll(() => inSight(page, '[aria-label="Title page"]')).toBe(false);
    await expect.poll(() => inSight(page, '[aria-label="Imprint"]')).toBe(false);
    // Nothing of it is the book's words: chosen whole, a copy has none of it.
    expect(await title.evaluate((element) => getComputedStyle(element).userSelect)).toBe('none');
  });

  test('Scroll has none of it: no front matter, no heads, the place carried', async ({
    page,
    app,
  }) => {
    await opened(page, app);
    await pastSpread(page, 40);
    // QA (#40, Phase 3d): into the book's first item, which Eien's front matter comes before.
    await page.keyboard.press('ArrowLeft');
    await expect(sheet(page).locator('.epub-front')).toHaveCount(1);
    await clickMenu(app, 'View', 'Scroll');
    await expect(leaf(page)).toHaveAttribute('data-view', 'scroll');
    await expect(box(page)).not.toHaveAttribute('data-spread');
    await expect(sheet(page).locator('.epub-heads')).toBeHidden();
    await expect(sheet(page).locator('.epub-front')).toBeHidden();
    await expect(sheet(page).locator('.sheet__head')).toBeVisible();
  });
});

test.describe('marks on the edge beside a spread', () => {
  test.use({
    deviceFile: { settings: { 'epub.view': 'pages', 'epub.turnSpeed': '0', 'epub.marks': 'edge' } },
  });

  test('stand past the sheet, never over the spread’s words', async ({ page, app }) => {
    await opened(page, app);
    await pastSpread(page, 40);
    await expect(box(page)).toHaveAttribute('data-spread', '');
    const strip = leaf(page).getByRole('slider', { name: 'The whole book' });
    await expect(strip).toBeVisible();
    const [edge, paper] = await Promise.all([strip.boundingBox(), sheet(page).boundingBox()]);
    if (!edge || !paper) throw new Error('no strip or sheet');
    expect(edge.x).toBeGreaterThanOrEqual(paper.x + paper.width - 1);
  });
});

test.describe('a narrow page', () => {
  test.use({
    vaultFiles: {
      'Novels/Pride and Prejudice.epub': BOOK,
      'At the Assembly.md': 'She hears it from two chairs away.\n',
    },
    deviceFile: {
      settings: { 'epub.view': 'pages', 'epub.turnSpeed': '0', 'appearance.split': 'sheets' },
    },
  });

  test('is ragged beside a note, wherever the window hyphenates (a Mac’s too)', async ({
    page,
  }) => {
    // Two sheets need 720px of pane; each page then under 520px.
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.locator('.note-row', { hasText: 'At the Assembly' }).click();
    await shelfBook(page).click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    const set = await chapter(page).evaluate((element) => ({
      width: (element.closest('.page__scroll') as HTMLElement).clientWidth,
      align: getComputedStyle(element.querySelector('p:not([data-part])') as HTMLElement).textAlign,
      spread: element.closest('.epub__pages')?.hasAttribute('data-spread'),
    }));
    expect(set.width).toBeLessThan(520);
    expect(set.align).toBe('start');
    expect(set.spread).toBe(false);
  });
});
