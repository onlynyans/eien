// A book's highlights (#40, Phase 5a): words chosen and H (or the selection
// bar's Highlight, or Format → Highlight) keep them, a pencil line under
// them painted over the page's own text and a tick in the margin by their
// paragraph, kept in .eien/reading across a restart, in Scroll and in Pages;
// H on them takes it off, its words left chosen, and Put back restores it;
// a turn's copy of the page carries the ink.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ALONE, clickMenu, closeApp, expect, launchApp, ROOT, test } from './launch';

const epub = (name: string) =>
  new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/epub', name)));

const leaf = (page: Page) => page.locator('.page__leaf--epub');

/** The highlights in the reading state's one file in `vault`. */
function highlightsIn(
  vault: string,
): { chapter: string; from: number; to: number; words: string }[] {
  const folder = join(vault, '.eien/reading');
  if (!existsSync(folder)) return [];
  const [file] = readdirSync(folder).filter((name) => name.endsWith('.json'));
  return file ? (JSON.parse(readFileSync(join(folder, file), 'utf8')).highlights ?? []) : [];
}

async function openBook(page: Page): Promise<void> {
  await page
    .locator('.tree-row--epub .tree-row__name')
    .filter({ hasText: 'Pride and Prejudice' })
    .click();
  await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
  await leaf(page).locator('.page__scroll').focus();
}

/** `words` chosen in the page's chapter in sight, as a hand would leave them. */
async function choose(page: Page, words: string): Promise<void> {
  await page.evaluate((words) => {
    const chapter = document.querySelector('.epub-sheet:not([aria-hidden]) .epub-chapter');
    const walker = document.createTreeWalker(chapter as Node, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = (node as Text).data.indexOf(words);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + words.length);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);
      return;
    }
    throw new Error(`no “${words}” on the page`);
  }, words);
}

/** The words the window's highlight ink covers now, every page's. */
const inked = (page: Page) =>
  page.evaluate(() =>
    [...(CSS.highlights.get('epub-highlight') ?? [])].map((range) => {
      const live = document.createRange();
      live.setStart(range.startContainer, range.startOffset);
      live.setEnd(range.endContainer, range.endOffset);
      return live.toString();
    }),
  );
const ticks = (page: Page) => leaf(page).locator('.epub-chapter [data-highlighted]');

test.describe('a book’s highlights', () => {
  test.use({ vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') } });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('H keeps the words chosen, inked and ticked, and they’re there after a restart', async ({
    page,
    app,
    vault,
    userData,
  }) => {
    if (!vault) throw new Error('no vault');
    await openBook(page);
    await choose(page, 'universally acknowledged');
    await page.keyboard.press('h');
    await expect.poll(() => inked(page)).toEqual(['universally acknowledged']);
    await expect(ticks(page)).toHaveCount(1);
    await expect
      .poll(() => highlightsIn(vault).map((each) => each.words))
      .toEqual(['universally acknowledged']);
    await closeApp(app);
    const again = await launchApp(userData, vault);
    const next = await again.firstWindow();
    await next.setViewportSize({ width: 1600, height: 900 });
    await openBook(next);
    await expect.poll(() => inked(next)).toEqual(['universally acknowledged']);
    await expect(ticks(next)).toHaveCount(1);
    await closeApp(again);
  });

  test('H on them takes it off, the words still chosen, and Put back restores it', async ({
    page,
    vault,
  }) => {
    if (!vault) throw new Error('no vault');
    await openBook(page);
    await choose(page, 'a single man in possession');
    await page.keyboard.press('h');
    await expect.poll(() => highlightsIn(vault).length).toBe(1);
    await choose(page, 'single man');
    await page.keyboard.press('h');
    await expect.poll(() => highlightsIn(vault).length).toBe(0);
    await expect.poll(() => inked(page)).toEqual([]);
    expect(await page.evaluate(() => document.getSelection()?.toString())).toBe(
      'a single man in possession',
    );
    await expect(page.locator('.colophon__said')).toHaveText('Highlight taken off.');
    await page.getByRole('button', { name: 'Put back' }).click();
    await expect
      .poll(() => highlightsIn(vault).map((each) => each.words))
      .toEqual(['a single man in possession']);
    await expect.poll(() => inked(page)).toEqual(['a single man in possession']);
  });

  test('the selection bar’s Highlight, and Format → Highlight, keep the words chosen', async ({
    page,
    app,
    vault,
  }) => {
    if (!vault) throw new Error('no vault');
    await openBook(page);
    // A hand's drag leaves the bar a moment after.
    const words = leaf(page).locator('.epub-chapter p').first();
    const box = await words.boundingBox();
    if (!box) throw new Error('no paragraph');
    await page.mouse.move(box.x + 4, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 4, { steps: 8 });
    await page.mouse.up();
    const bar = page.locator('.selection-bar');
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: 'Highlight', exact: true }).click();
    await expect.poll(() => highlightsIn(vault).length).toBe(1);
    await choose(page, 'must be in want of a wife');
    await clickMenu(app, 'Format', 'Highlight');
    await expect.poll(() => highlightsIn(vault).length).toBe(2);
  });
});

test.describe('a book’s highlights in pages', () => {
  test.use({
    vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') },
    deviceFile: {
      settings: { 'epub.view': 'pages', 'epub.turn': 'slide', 'epub.turnSpeed': '4' },
    },
  });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test(
    'are kept across a restart, and a turn’s copy of the page carries the ink',
    ALONE,
    async ({ page, app, vault, userData }) => {
      if (!vault) throw new Error('no vault');
      await openBook(page);
      await choose(page, 'It is a truth');
      await page.keyboard.press('h');
      await expect.poll(() => highlightsIn(vault).length).toBe(1);
      await expect.poll(() => inked(page)).toEqual(['It is a truth']);
      // Four times slower: the copy turning away is there long enough to see its ink.
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.turn-copy [data-ink="epub-highlight"]').first()).toHaveText(
        'It is a truth',
      );
      await expect(page.locator('.turn-copy')).toHaveCount(0);
      await closeApp(app);
      const again = await launchApp(userData, vault);
      const next = await again.firstWindow();
      await next.setViewportSize({ width: 1600, height: 900 });
      await openBook(next);
      await expect.poll(() => inked(next)).toContain('It is a truth');
      await closeApp(again);
    },
  );
});

test.describe('a book’s highlights among its marks (Phase 5b)', () => {
  test.use({ vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') } });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('] and [ walk a highlight and a bookmark across chapters, round the book', async ({
    page,
  }) => {
    await openBook(page);
    await choose(page, 'It is a truth');
    await page.keyboard.press('h');
    await expect.poll(() => inked(page)).toEqual(['It is a truth']);
    // A bookmark at the third chapter's top.
    await page.locator('.contents-row').nth(2).click();
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('b');
    await page.locator('.contents-row').nth(0).click();
    await leaf(page).locator('.page__scroll').focus();
    const said = page.locator('.colophon__said');
    // The highlight's in sight: ] goes past it, to the bookmark.
    // Each chapter headed by an h1, as Eien's export writes it (core/export/epub.ts).
    await page.keyboard.press(']');
    await expect(said).toHaveText('Bookmark, 2 of 2 marks.');
    await expect(leaf(page).locator('.epub-chapter h1').first()).toHaveText(/Chapter III/u);
    await page.keyboard.press('[');
    await expect(said).toHaveText('Highlight, 1 of 2 marks.');
    await expect(leaf(page).locator('.epub-chapter h1').first()).toHaveText(/Chapter I\b/u);
    await page.keyboard.press('[');
    await expect(said).toHaveText('Round to the last: Bookmark, 2 of 2 marks.');
  });

  test('lists a highlight under Marks in its words, Delete taking it off with Put back', async ({
    page,
    vault,
  }) => {
    if (!vault) throw new Error('no vault');
    await openBook(page);
    await choose(page, 'universally acknowledged');
    await page.keyboard.press('h');
    await expect.poll(() => highlightsIn(vault).length).toBe(1);
    await page.getByRole('button', { name: /^Marks \d+$/u }).click();
    const row = page.locator('.mark-row');
    await expect(row.locator('.mark-row__words')).toHaveText('universally acknowledged');
    await expect(row.locator('.mark-row__chapter')).toHaveText(/ · highlight$/u);
    await row.focus();
    await page.keyboard.press('Delete');
    await expect.poll(() => highlightsIn(vault).length).toBe(0);
    await page.getByRole('button', { name: 'Put back' }).click();
    await expect.poll(() => highlightsIn(vault).length).toBe(1);
  });
});
