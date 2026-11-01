// A book scrolls a chapter a sheet (#40, Phase 2): the chapters either side
// at its foot, how far through in the colophon, its paragraphs as the scroll
// style sets them, and its place kept to the line: across a restart, ⇄, a
// new width and page zoom.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { clickMenu, closeApp, expect, launchApp, ROOT, test } from './launch';

const epub = (name: string) =>
  new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/epub', name)));

const shelfEpub = (page: Page, title: string) =>
  page.locator('.tree-row--epub .tree-row__name').filter({ hasText: title });
const leaf = (page: Page) => page.locator('.page__leaf--epub');
const chapter = (page: Page) => leaf(page).locator('.epub-chapter');
const scroller = (page: Page) => leaf(page).locator('.page__scroll');
const look = (page: Page) =>
  page.locator('[data-command="look"]:not(.phone-bar__controls *, .page__phone *)');

/** The book's scroller moved to `top`, as a hand would leave it. */
const scrollTo = (page: Page, top: number) =>
  scroller(page).evaluate((element, to) => {
    element.scrollTop = to;
  }, top);

/** The paragraph whose line is at the scroller's top, and how far the scroller is from it. */
const inSight = (page: Page) =>
  scroller(page).evaluate((element) => {
    const box = element.getBoundingClientRect();
    const words = element.querySelector('.epub-chapter')?.getBoundingClientRect();
    const at = document.caretRangeFromPoint((words?.left ?? box.left) + 4, box.top + 2);
    const paragraph = at?.startContainer.parentElement?.closest('p');
    return {
      words: paragraph?.textContent?.slice(0, 60) ?? '',
      lineOff: paragraph ? Math.round(paragraph.getBoundingClientRect().top - box.top) : 0,
      top: element.scrollTop,
    };
  });

/** The reading state's one file in `vault`. */
function readingIn(vault: string): { chapter?: string; place?: { offset: number } } {
  const folder = join(vault, '.eien/reading');
  if (!existsSync(folder)) return {};
  const [file] = readdirSync(folder).filter((name) => name.endsWith('.json'));
  return file ? JSON.parse(readFileSync(join(folder, file), 'utf8')) : {};
}

test.describe('a chapter a sheet', () => {
  test.use({
    vaultFiles: {
      'Novels/Pride and Prejudice.epub': epub('plain.epub'),
      'Chapter.md': 'The gate held.\n',
      'Notes.md': 'Snow on the walls.\n',
    },
  });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('turns to the chapters either side at its foot, the colophon saying how far through', async ({
    page,
  }) => {
    await shelfEpub(page, 'Pride and Prejudice').click();
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    const colophon = page.locator('.colophon');
    // The chapter's own figure, in the page's place scrolling (#67), whole: "0%" is in "100%" too.
    const chapterFigure = colophon.locator('.colophon__page');
    await expect(chapterFigure).toHaveText('0% of the chapter');
    await expect(colophon).toContainText(/\d+% of the book/u);
    const turns = leaf(page).getByRole('navigation', { name: 'Chapters' });
    await scroller(page).focus();
    await page.keyboard.press('End');
    await expect(chapterFigure).toHaveText('100% of the chapter');
    await turns.getByRole('button', { name: 'Next chapter: Chapter II' }).click();
    await expect(chapter(page)).toContainText('Mr. Bennet was among the earliest');
    await expect(scroller(page)).toBeFocused();
    expect(await scroller(page).evaluate((element) => element.scrollTop)).toBe(0);
    await expect(chapterFigure).toHaveText('0% of the chapter');
    await expect(page.locator('.contents-row').nth(1)).toHaveAttribute('aria-current', 'true');
    await turns.getByRole('button', { name: 'Previous chapter: Chapter I' }).click();
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    await page.locator('.contents-row').nth(2).click();
    await expect(turns).toContainText('The end');
  });

  test('sets its paragraphs as a note’s, or indented as a book’s', async ({ page }) => {
    await shelfEpub(page, 'Pride and Prejudice').click();
    const paragraphs = chapter(page).locator('p');
    await expect(paragraphs.nth(3)).toBeVisible();
    const set = (at: number) =>
      paragraphs.nth(at).evaluate((p) => {
        const style = getComputedStyle(p);
        return { indent: parseFloat(style.textIndent), gap: parseFloat(style.marginBottom) };
      });
    // As a note, as Phase 1 drew it: a gap between, no indent.
    expect(await set(2)).toMatchObject({ indent: 0 });
    expect((await set(2)).gap).toBeGreaterThan(0);
    await look(page).click();
    const dialog = page.getByRole('dialog', { name: 'Look: Shelf' });
    await dialog.locator('[data-setting="epub.scroll"] [data-value="book"]').click();
    await expect(leaf(page)).toHaveAttribute('data-scroll', 'book');
    expect(await set(2)).toEqual({ indent: expect.any(Number), gap: 0 });
    expect((await set(2)).indent).toBeGreaterThan(0);
    // The chapter's first line stands flush.
    expect((await set(0)).indent).toBe(0);
    // A named part keeps its own gap: Chapter III's picture.
    await page.locator('.contents-row').nth(2).click();
    const plate = chapter(page).locator('[data-part="plate"]');
    await expect(plate).toBeVisible();
    expect(
      await plate.evaluate((element) => Number.parseFloat(getComputedStyle(element).marginTop)),
    ).toBeGreaterThan(0);
    await look(page).click(); // choosing a chapter closed it
    await dialog.locator('[data-setting="epub.scroll"] [data-value="note"]').click();
    await page.locator('.contents-row').first().click();
    expect((await set(2)).indent).toBe(0);
  });

  test('keeps its line across a restart, in .eien/reading', async ({
    page,
    vault,
    userData,
    app,
  }) => {
    if (!vault) throw new Error('no vault');
    await shelfEpub(page, 'Pride and Prejudice').click();
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    await scrollTo(page, 900);
    await expect.poll(() => readingIn(vault).place?.offset ?? 0).toBeGreaterThan(0);
    const before = await inSight(page);
    await closeApp(app);
    const again = await launchApp(userData, vault);
    const next = await again.firstWindow();
    await next.setViewportSize({ width: 1600, height: 900 });
    await shelfEpub(next, 'Pride and Prejudice').click();
    await expect.poll(async () => (await inSight(next)).words).toBe(before.words);
    expect(Math.abs((await inSight(next)).top - before.top)).toBeLessThan(60);
    await closeApp(again);
  });

  test('keeps its line through ⇄ before it comes to rest, a narrower window, page zoom and a new look', async ({
    app,
    page,
    vault,
  }) => {
    if (!vault) throw new Error('no vault');
    await page.locator('.note-row', { hasText: 'Chapter' }).click();
    await page.locator('.note-row', { hasText: 'Notes' }).click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
    await shelfEpub(page, 'Pride and Prejudice').click();
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    await scrollTo(page, 1200);
    const words = async () => (await inSight(page)).words;
    const kept = await words();
    // Swapped within the second, before the scroll comes to rest.
    await clickMenu(app, 'View', 'Swap Pages');
    await expect(page.locator('.page__pages > .page__leaf').nth(0)).toHaveClass(
      /page__leaf--epub/u,
    );
    await expect.poll(words).toBe(kept);
    // Then at rest, the line it was left at kept, never the top the swap began it at.
    await expect.poll(() => readingIn(vault).place?.offset ?? 0).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1200, height: 900 });
    await expect.poll(words).toBe(kept);
    // The keyboard in the page: its zoom, not the window's.
    await scroller(page).focus();
    for (let i = 0; i < 5; i++) await clickMenu(app, 'View', 'Zoom In');
    await expect(page.locator('.colophon__zoom')).toHaveText('150%');
    await expect.poll(words).toBe(kept);
    // A new look in the quick look: the lines move, the line in sight doesn't.
    await look(page).click();
    await page
      .getByRole('dialog', { name: 'Look: Shelf' })
      .locator('[data-setting="epub.scroll"] [data-value="book"]')
      .click();
    await expect(leaf(page)).toHaveAttribute('data-scroll', 'book');
    await expect.poll(words).toBe(kept);
  });
});
