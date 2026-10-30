// A book on the phone (#40): SHELF in the sidebar, the book a page of the
// phone's stack, its contents the list behind its back bar.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import { seriousViolations } from '../e2e/axe';
import { bytesOutside, listOutside, open, putBytesOutside, putOutside, titles } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');
const back = (page: Page) => page.locator('.phone-bar__back');
const chapter = (page: Page) => page.locator('.epub-chapter');

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme });

    test('a book opens from the shelf, its contents behind its back bar, with no serious violation', async ({
      page,
    }) => {
      await open(page);
      await putOutside(page, 'Eien/Vault/Notes.md', 'Notes on the book.\n');
      await putBytesOutside(
        page,
        'Eien/Vault/Novels/Pride and Prejudice.epub',
        readFileSync(FIXTURE).toString('base64'),
      );
      await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
      await back(page).click(); // the list's back: the sidebar
      const book = page.locator('.tree-row--epub .tree-row__name', {
        hasText: 'Pride and Prejudice',
      });
      await expect(book).toBeVisible({ timeout: 10_000 });
      expect(await seriousViolations(page), 'the shelf').toEqual([]);
      await book.click();
      await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
      await expect(chapter(page)).toBeInViewport();
      // Its page (#40, Phase 4): a steady one, once the book is counted.
      await expect(page.locator('.colophon__page')).toHaveText(/^page 1 of \d+$/u);
      // Bookmarked from the page's ⋯ (Phase 4b): its mark, and the choice checked after.
      await page.getByRole('button', { name: 'More' }).click();
      await page.getByRole('menuitemcheckbox', { name: 'Bookmark this page' }).click();
      await expect(page.locator('.page__mark--bookmark')).toBeVisible();
      expect(await seriousViolations(page), 'a bookmarked page').toEqual([]);
      await page.getByRole('button', { name: 'More' }).click();
      await expect(
        page.getByRole('menuitemcheckbox', { name: 'Bookmark this page' }),
      ).toHaveAttribute('aria-checked', 'true');
      await page.keyboard.press('Escape');
      // The note's tools set aside on a book (#40): its views and Focus, never greyed; Look stays.
      await expect(page.locator('[data-command="view.next"]:visible')).toHaveCount(0);
      await expect(page.locator('[data-command="focus"]:visible')).toHaveCount(0);
      await expect(page.locator('.phone-bar__controls [data-command="look"]')).toBeVisible();
      expect(await seriousViolations(page), 'the book').toEqual([]);
      await back(page).click();
      const rows = page.locator('.contents-row');
      await expect(rows).toHaveText(['Chapter I', 'Chapter II', 'Chapter III']);
      expect(await seriousViolations(page), 'its contents').toEqual([]);
      await rows.nth(2).click();
      await expect(chapter(page)).toContainText('Not all that Mrs. Bennet');
      // The chapter chosen brings the page back into sight.
      await expect(chapter(page)).toBeInViewport();
      await expect(chapter(page).locator('img')).toHaveAttribute('src', /^blob:/u);
    });
  });
}

test('a book’s place is kept as the phone goes to the background, and back after a restart', async ({
  page,
}) => {
  await page.clock.install();
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await back(page).click(); // the list's back: the sidebar
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  // The chapters either side at its foot, at a finger's size.
  const next = page.getByRole('button', { name: 'Next chapter: Chapter II' });
  expect((await next.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  const scroller = page.locator('.page__leaf--epub .page__scroll');
  const inSight = () =>
    scroller.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const at = document.caretRangeFromPoint(box.left + box.width / 2, box.top + 4);
      return at?.startContainer.parentElement?.closest('p')?.textContent?.slice(0, 60) ?? '';
    });
  // The clock stops: the place is never kept at a rest, only on the way out.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
  await scroller.evaluate((element) => {
    element.scrollTop = 1500;
  });
  const kept = await inSight();
  expect(kept).not.toBe('');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => listOutside(page, 'Eien/Vault/.eien/reading')).toHaveLength(1);
  await page.clock.resume();
  await open(page);
  await back(page).click();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect.poll(inSight).toBe(kept);
});

// QA (#40, Phase 4a): a phone's page is under 560px, where the colophon drops
// how far through but keeps the page; and a printed edition's pages there too.
test('a printed book’s page shows on the phone’s narrow colophon, how far through dropped', async ({
  page,
}) => {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Printed.epub',
    readFileSync(join(import.meta.dirname, '../fixtures/epub/page-list.epub')).toString('base64'),
  );
  await back(page).click(); // the list's back: the sidebar
  await page.locator('.tree-row--epub .tree-row__name').click({ timeout: 10_000 });
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  // The front matter's page, before the chapter's first numbered one.
  const figure = page.locator('.colophon__page');
  await expect(figure).toHaveText('page xii of 5');
  await expect(figure).toBeVisible();
  await expect(page.locator('.colophon__through')).toHaveCount(2);
  for (const through of await page.locator('.colophon__through').all())
    await expect(through).toBeHidden();
  await back(page).click();
  await page.locator('.contents-row').nth(1).click();
  await expect(chapter(page)).toBeInViewport();
  await expect(figure).toHaveText('page 2 of 5');
});

test('a book’s row menu renames it in its row, and trashes it to .eien/trash, whole', async ({
  page,
}) => {
  await open(page);
  await putOutside(page, 'Eien/Vault/Notes.md', 'Notes on the book.\n');
  const bytes = readFileSync(FIXTURE).toString('base64');
  await putBytesOutside(page, 'Eien/Vault/Novels/Pride and Prejudice.epub', bytes);
  await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
  await back(page).click(); // the sidebar
  const book = (title: string) =>
    page.locator('.tree-row--epub .tree-row__name', { hasText: new RegExp(`^${title}$`, 'u') });
  await expect(book('Pride and Prejudice')).toBeVisible({ timeout: 10_000 });

  // Renamed in its row, as on the desktop: a book's page has no title to type in.
  await book('Pride and Prejudice').click({ button: 'right' });
  // A phone names it .eien/trash; this page in Chromium is Capacitor's 'web', which says the
  // trash. Either way the book lands in .eien/trash, below.
  const trashItem = /^Move to (\.eien\/trash|the trash)$/u;
  await expect(page.getByRole('menuitem')).toHaveText(['Rename', 'Move to…', trashItem]);
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const field = page.locator('.name-field__input');
  await expect(field).toHaveValue('Pride and Prejudice');
  await expect(page.locator('.name-field__suffix')).toHaveText('.epub');
  await field.fill('First Impressions');
  await field.press('Enter');
  await expect(book('First Impressions')).toBeVisible({ timeout: 10_000 });
  expect(await listOutside(page, 'Eien/Vault/Novels')).toEqual(['First Impressions.epub']);

  // The trash: the vault's own, where any device can take it back.
  await book('First Impressions').click({ button: 'right' });
  await page.getByRole('menuitem', { name: trashItem }).click();
  await expect(book('First Impressions')).toHaveCount(0, { timeout: 10_000 });
  const stamps = await listOutside(page, 'Eien/Vault/.eien/trash');
  expect(stamps).toHaveLength(1);
  expect(
    await bytesOutside(page, `Eien/Vault/.eien/trash/${stamps[0]}/First Impressions.epub`),
  ).toEqual([...readFileSync(FIXTURE)]);
});

test('a folder of books alone is on SHELF only, where it folds and moves by its menu (#40)', async ({
  page,
}) => {
  await open(page);
  await putOutside(page, 'Eien/Vault/Notes.md', 'Notes on the books.\n');
  const bytes = readFileSync(FIXTURE).toString('base64');
  await putBytesOutside(page, 'Eien/Vault/Classics/Emma.epub', bytes);
  await putBytesOutside(page, 'Eien/Vault/Novels/Persuasion.epub', bytes);
  await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
  await back(page).click(); // the sidebar
  const shelf = page.locator('#sidebar-shelf .tree-row--shelf-folder');
  await expect(shelf).toHaveText(['Classics', 'Novels'], { timeout: 10_000 });
  await expect(page.locator('[data-key^="folder:"]')).toHaveCount(0);

  // A tap on its name shuts it, and another opens it.
  const classics = page.locator('[data-key="shelf:Classics"]');
  await classics.click();
  await expect(classics).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.tree-row--epub', { hasText: 'Emma' })).toHaveCount(0);
  await classics.click();
  await expect(page.locator('.tree-row--epub', { hasText: 'Emma' })).toBeVisible();

  // No drag on a phone: its menu moves it among SHELF's folders.
  await classics.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Move down' }).click();
  await expect(shelf).toHaveText(['Novels', 'Classics'], { timeout: 10_000 });
  expect(await seriousViolations(page), 'SHELF’s folders').toEqual([]);
});

test('the shelf’s look on the phone says at its foot that Settings sets notes', async ({
  page,
}) => {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await back(page).click();
  await page.locator('.tree-row--epub .tree-row__name').click({ timeout: 10_000 });
  await expect(chapter(page)).toContainText('It is a truth');
  await page
    .locator('.phone-bar__controls [data-command="look"], .page__phone [data-command="look"]')
    .first()
    .click();
  const sheet = page.getByRole('dialog', { name: 'Look: Shelf' });
  await expect(sheet.locator('.quick-look__foot .quick-look__line')).toHaveText(
    'Settings sets notes; this is every book’s look.',
  );
  expect(await seriousViolations(page), 'the shelf’s sheet').toEqual([]);
});

test('a note’s reference shows the note over the page, a tap away from the words, with no serious violation', async ({
  page,
}) => {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Links.epub',
    readFileSync(join(import.meta.dirname, '../fixtures/epub/links.epub')).toString('base64'),
  );
  await back(page).click();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Links' }).click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  await chapter(page).locator('sup a[href]').tap();
  const note = page.getByRole('dialog', { name: 'Note 1' });
  await expect(note).toContainText('The novel’s first sentence, and its most quoted.');
  await expect(note).toBeInViewport();
  expect(await seriousViolations(page), 'a note over the page').toEqual([]);
  await note.getByRole('button', { name: 'Go to the note' }).tap();
  await expect(chapter(page)).toContainText('The novel’s first sentence, and its most quoted.');
  await expect(page.getByRole('button', { name: 'Back to Chapter I' })).toBeVisible();
});

/** The first words on the page in sight, in pages. */
const firstWords = (page: Page) =>
  page.locator('.epub-sheet:not([aria-hidden]) .epub__pages').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const at = document.caretRangeFromPoint(rect.left + 2, rect.top + 4);
    return at?.startContainer.textContent?.slice(at.startOffset, at.startOffset + 30) ?? '';
  });

test('a book in pages turns by a tap in its outer thirds and a finger drawn across (#40, Phase 3)', async ({
  page,
}) => {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await back(page).click();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  // Pages, from the shelf's look.
  await page.locator('.phone-bar__controls [data-command="look"]').click();
  await page.locator('[data-setting="epub.view"] [data-value="pages"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.page__leaf--epub')).toHaveAttribute('data-view', 'pages');
  const box = page.locator('.epub-sheet:not([aria-hidden]) .epub__pages');
  const first = await firstWords(page);
  const rect = await box.boundingBox();
  if (!rect) throw new Error('no page');
  // A tap in the right third: on.
  await page.touchscreen.tap(rect.x + rect.width * 0.9, rect.y + rect.height / 2);
  await expect.poll(() => firstWords(page)).not.toBe(first);
  const second = await firstWords(page);
  // A finger drawn rightward across the page: back (reduced motion: at once, nothing held).
  await box.dispatchEvent('pointerdown', {
    pointerId: 7,
    pointerType: 'touch',
    button: 0,
    clientX: rect.x + 40,
    clientY: rect.y + 200,
  });
  await page.evaluate(
    ([x, y]) => {
      const at = (clientX: number) => ({
        pointerId: 7,
        pointerType: 'touch',
        clientX,
        clientY: y,
        bubbles: true,
      });
      window.dispatchEvent(new PointerEvent('pointermove', at(x + 20)));
      window.dispatchEvent(new PointerEvent('pointermove', at(x + 120)));
      window.dispatchEvent(new PointerEvent('pointerup', at(x + 120)));
    },
    [rect.x + 40, rect.y + 200] as const,
  );
  await expect.poll(() => firstWords(page)).toBe(first);
  expect(second).not.toBe(first);
});
