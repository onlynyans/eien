// A book in pages (#40, Phase 3b): the chapter laid in pages of whole lines,
// turned by key and by its edges, on into the next chapter and back; the
// place carried between Pages and Scroll, and kept across a restart and a
// page zoom; the fore-edge's paper showing how far through.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { clickMenu, closeApp, expect, launchApp, ROOT, test } from './launch';

const epub = (name: string) =>
  new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/epub', name)));

const shelfEpub = (page: Page, title: string) =>
  page.locator('.tree-row--epub .tree-row__name').filter({ hasText: title });
const leaf = (page: Page) => page.locator('.page__leaf--epub');
/** The book's own chapter on its sheet, never a turn's copy of it. */
const chapter = (page: Page) => leaf(page).locator('.epub-sheet:not([aria-hidden]) .epub-chapter');
const box = (page: Page) => leaf(page).locator('.epub-sheet:not([aria-hidden]) .epub__pages');
const scroller = (page: Page) => leaf(page).locator('.page__scroll');

/** The first words in sight on the page: what's at the box's top left. */
const firstWords = (page: Page) =>
  box(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const at = document.caretRangeFromPoint(rect.left + 2, rect.top + 4);
    const node = at?.startContainer;
    return node?.textContent?.slice(at?.startOffset ?? 0, (at?.startOffset ?? 0) + 30) ?? '';
  });

/** The words at the scroller's top, in Scroll: the place carried over from Pages. */
const scrolledTo = (page: Page) =>
  scroller(page).evaluate((element) => {
    const box = element.getBoundingClientRect();
    const words = element.querySelector('.epub-chapter')?.getBoundingClientRect();
    const at = document.caretRangeFromPoint((words?.left ?? box.left) + 4, box.top + 30);
    return at?.startContainer.textContent ?? '';
  });

/** The reading state's one file in `vault`. */
function readingIn(vault: string): { place?: { offset: number } } {
  const folder = join(vault, '.eien/reading');
  if (!existsSync(folder)) return {};
  const [file] = readdirSync(folder).filter((name) => name.endsWith('.json'));
  return file ? JSON.parse(readFileSync(join(folder, file), 'utf8')) : {};
}

/** How the box and the chapter's lines stand: whole lines tall, nothing cut. */
const laidOut = (page: Page) =>
  chapter(page).evaluate((element) => {
    const line = Number.parseFloat(getComputedStyle(element).lineHeight);
    return { height: element.getBoundingClientRect().height, line };
  });

test.describe('a book in pages', () => {
  test.use({
    vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') },
    deviceFile: { settings: { 'epub.view': 'pages', 'epub.turnSpeed': '0' } },
  });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1400, height: 800 }));

  test('lays the chapter in pages of whole lines, turned by key and on into the next chapter', async ({
    page,
  }) => {
    await shelfEpub(page, 'Pride and Prejudice').click();
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    const { height, line } = await laidOut(page);
    expect(height / line).toBeCloseTo(Math.round(height / line), 5);
    expect(await scroller(page).evaluate((element) => element.scrollTop)).toBe(0);
    const first = await firstWords(page);
    await scroller(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => firstWords(page)).not.toBe(first);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => firstWords(page)).toBe(first);
    // To the chapter's last page, and on: the next chapter's first.
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowRight');
    await expect(chapter(page)).toContainText('Mr. Bennet was among the earliest');
    await expect.poll(() => firstWords(page)).toMatch(/^\S/u);
    // Back again: the last page of the chapter before.
    await page.keyboard.press('ArrowLeft');
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    expect(await firstWords(page)).not.toBe(first);
  });

  test('turns by its edges, which say how many pages are left', async ({ page }) => {
    await shelfEpub(page, 'Pride and Prejudice').click();
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    const next = leaf(page).getByRole('button', { name: 'Next page' });
    await expect(next).toHaveAttribute('data-tip', /Next page · \d+ pages? on in the chapter/u);
    const first = await firstWords(page);
    await next.click();
    await expect.poll(() => firstWords(page)).not.toBe(first);
    await leaf(page).getByRole('button', { name: 'Previous page' }).click();
    await expect.poll(() => firstWords(page)).toBe(first);
    // The pages to read lie stacked beneath the sheet.
    expect(
      await leaf(page).locator('.epub-edges__stack--after .epub-edges__edge').count(),
    ).toBeGreaterThan(0);
  });

  test('carries its place between Pages and Scroll, the tools and the menu saying which', async ({
    app,
    page,
  }) => {
    await shelfEpub(page, 'Pride and Prejudice').click();
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    const pagesTool = page.locator('[data-command="view.pages"]:not(.page__phone *)').first();
    const scrollTool = page.locator('[data-command="view.scroll"]:not(.page__phone *)').first();
    await expect(pagesTool).toHaveAttribute('aria-pressed', 'true');
    await scroller(page).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const turnedTo = await firstWords(page);
    await scrollTool.click();
    await expect(leaf(page)).toHaveAttribute('data-view', 'scroll');
    await expect(scrollTool).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => scrolledTo(page)).toContain(turnedTo.trim().slice(0, 12));
    await clickMenu(app, 'View', 'Pages');
    await expect(leaf(page)).toHaveAttribute('data-view', 'pages');
    await expect.poll(() => firstWords(page)).toBe(turnedTo);
  });

  test('keeps its page across a restart', async ({ page, vault, userData, app }) => {
    if (!vault) throw new Error('no vault');
    await shelfEpub(page, 'Pride and Prejudice').click();
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    await scroller(page).focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    const turnedTo = await firstWords(page);
    await expect.poll(() => readingIn(vault).place?.offset ?? 0).toBeGreaterThan(0);
    await closeApp(app);
    const again = await launchApp(userData, vault);
    const next = await again.firstWindow();
    await next.setViewportSize({ width: 1400, height: 800 });
    await shelfEpub(next, 'Pride and Prejudice').click();
    await expect.poll(() => firstWords(next)).toBe(turnedTo);
    await closeApp(again);
  });

  test('turns at page zoom 150%, its page whole lines still', async ({ app, page }) => {
    await shelfEpub(page, 'Pride and Prejudice').click();
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    await scroller(page).focus();
    for (let i = 0; i < 5; i++) await clickMenu(app, 'View', 'Zoom In');
    await expect(page.locator('.colophon__zoom')).toHaveText('150%');
    await page.keyboard.press('ArrowRight');
    const turnedTo = await firstWords(page);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => firstWords(page)).not.toBe(turnedTo);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => firstWords(page)).toBe(turnedTo);
    const { height, line } = await laidOut(page);
    expect(height / line).toBeCloseTo(Math.round(height / line), 1);
  });

  test('offers Pages or Scroll, the Page turn and Turn speed in the shelf’s quick look', async ({
    page,
  }) => {
    await shelfEpub(page, 'Pride and Prejudice').click();
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    await page.locator('[data-command="look"]:not(.phone-bar__controls *, .page__phone *)').click();
    const look = page.getByRole('dialog', { name: 'Look: Shelf' });
    for (const key of ['epub.view', 'epub.turn', 'epub.turnSpeed', 'epub.scroll']) {
      await expect(look.locator(`[data-setting="${key}"]`)).toBeVisible();
    }
    await look.locator('[data-setting="epub.turn"] [data-value="words"]').click();
    await expect(look.locator('[data-setting="epub.turn"] [data-value="words"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
