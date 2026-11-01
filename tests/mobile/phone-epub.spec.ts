// A book on the phone (#40): SHELF in the sidebar, the book a page of the
// phone's stack, its contents the list behind its back bar.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import { seriousViolations } from '../e2e/axe';
import {
  bytesOutside,
  listOutside,
  open,
  putBytesOutside,
  putOutside,
  readOutside,
  titles,
} from './outside';

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
      await expect(page.locator('.page__mark--bookmark[data-edge="right"]')).toBeVisible();
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
      // Marks in the contents page (Phase 4c): the bookmark made from the ⋯.
      await page.getByRole('button', { name: /^Marks \d+$/u }).click();
      await expect(page.locator('.mark-row')).toHaveCount(1);
      expect(await seriousViolations(page), 'its marks').toEqual([]);
      await page.getByRole('button', { name: /^Contents \d+$/u }).click();
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

test('a book’s Marks on its contents page: lenses a finger high, a row tapped going to its page (#40, Phase 4c)', async ({
  page,
}) => {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await back(page).click(); // the list's back: the sidebar
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Bookmark this page' }).click();
  await expect(page.locator('.page__mark--bookmark[data-edge="right"]')).toBeVisible();
  // Another chapter, so the bookmark's row has somewhere to go back to.
  await back(page).click();
  await page.locator('.contents-row').nth(2).click();
  await expect(chapter(page)).toContainText('Not all that Mrs. Bennet');
  await back(page).click();
  const marks = page.getByRole('button', { name: /^Marks \d+$/u });
  const contents = page.getByRole('button', { name: /^Contents \d+$/u });
  // A finger's size, as the chapters' turns are: the phone's touch is --eien-touch, 44px.
  for (const lens of [marks, contents])
    expect((await lens.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await marks.click();
  await expect(marks).toHaveAttribute('aria-pressed', 'true');
  const row = page.locator('.mark-row');
  await expect(row).toHaveCount(1);
  await expect(row.locator('.mark-row__chapter')).toHaveText('Chapter I');
  await row.click();
  // The page comes into sight at the bookmark, its mark on it.
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  await expect(chapter(page)).toBeInViewport();
  await expect(page.locator('.page__mark--bookmark[data-edge="right"]')).toBeVisible();
  // Back again, the lens is as it was left: the same book.
  await back(page).click();
  await expect(marks).toHaveAttribute('aria-pressed', 'true');
});

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

// QA (#40, Phase 4b): the ⋯ is the phone's only way to a bookmark, so it must take one off too,
// and what it makes must reach the reading file the desktop reads.
test('a bookmark made and taken off from the ⋯, kept in the reading file between', async ({
  page,
}) => {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await back(page).click(); // the list's back: the sidebar
  const book = page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' });
  await expect(book).toBeVisible({ timeout: 10_000 });
  await book.click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  const choice = () => page.getByRole('menuitemcheckbox', { name: 'Bookmark this page' });
  const mark = page.locator('.page__mark--bookmark[data-edge="right"]');
  // The phone's colophon is its own, at the foot of the screen, not inside the page's leaf.
  const said = page.locator('.colophon__said');
  /** The bookmarks in the book's one reading file. */
  const bookmarks = async () => {
    const [name] = await listOutside(page, 'Eien/Vault/.eien/reading');
    if (!name) return [];
    const text = await readOutside(page, `Eien/Vault/.eien/reading/${name}`);
    return text ? (JSON.parse(text).bookmarks ?? []) : [];
  };

  await page.getByRole('button', { name: 'More' }).click();
  await expect(choice()).toHaveAttribute('aria-checked', 'false');
  await choice().click();
  await expect(mark).toBeVisible();
  await expect(said).toHaveText('Bookmarked.');
  await expect.poll(async () => (await bookmarks()).length).toBe(1);
  expect((await bookmarks())[0]?.words).toMatch(/It is a truth/u);

  await page.getByRole('button', { name: 'More' }).click();
  await expect(choice()).toHaveAttribute('aria-checked', 'true');
  await choice().click();
  await expect(mark).toBeHidden();
  await expect(said).toHaveText('Bookmark taken off.');
  await expect.poll(async () => (await bookmarks()).length).toBe(0);
  await page.getByRole('button', { name: 'More' }).click();
  await expect(choice()).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
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

test('a book’s marks on the edge: the strip down the screen, a finger scrubbing it (#40, Phase 4d)', async ({
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
  await page.locator('.phone-bar__controls [data-command="look"]').click();
  await page.locator('[data-setting="epub.marks"] [data-value="edge"]').click();
  await page.keyboard.press('Escape');
  const strip = page.locator('.edge-strip');
  await expect(strip).toBeVisible();
  const box = await strip.boundingBox();
  const screen = page.viewportSize();
  if (!box || !screen) throw new Error('no strip');
  // A finger wide, clear of the screen's edge (Android's Back).
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(screen.width - (box.x + box.width)).toBeGreaterThanOrEqual(16);
  expect(await seriousViolations(page), 'the strip').toEqual([]);
  // A tap alone goes nowhere: a finger scrolling may start there.
  const x = box.x + box.width / 2;
  await page.touchscreen.tap(x, box.y + box.height - 2);
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  // A finger drawn down it to the book's end and lifted: its last chapter.
  await strip.evaluate(
    (element, at) => {
      const touch = (type: string, y: number) =>
        element.dispatchEvent(
          new PointerEvent(type, {
            pointerType: 'touch',
            pointerId: 7,
            clientX: at.x,
            clientY: y,
            button: 0,
            bubbles: true,
          }),
        );
      touch('pointerdown', at.top + 4);
      touch('pointermove', at.top + at.height / 2);
      touch('pointermove', at.top + at.height - 2);
      touch('pointerup', at.top + at.height - 2);
    },
    { x, top: box.y, height: box.height },
  );
  await expect(chapter(page)).toContainText('Not all that Mrs. Bennet');
});

// QA (#40, Phase 4d): the tip a scrub shows beside the finger is words on
// raised paper, shown only while a finger holds the strip, so no check at
// rest ever reads its contrast: held here, by day and by night.
for (const colorScheme of ['light', 'dark'] as const) {
  test(`a scrub’s tip on the strip has no serious violation, ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await open(page);
    await putBytesOutside(
      page,
      'Eien/Vault/Novels/Pride and Prejudice.epub',
      readFileSync(FIXTURE).toString('base64'),
    );
    await back(page).click();
    await page
      .locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' })
      .click();
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    await page.locator('.phone-bar__controls [data-command="look"]').click();
    await page.locator('[data-setting="epub.marks"] [data-value="edge"]').click();
    await page.keyboard.press('Escape');
    const strip = page.locator('.edge-strip');
    const box = await strip.boundingBox();
    if (!box) throw new Error('no strip');
    const x = box.x + box.width / 2;
    // A finger down on the strip and drawn along it, still held.
    await strip.dispatchEvent('pointerdown', {
      pointerId: 5,
      pointerType: 'touch',
      button: 0,
      clientX: x,
      clientY: box.y + box.height * 0.3,
    });
    await strip.dispatchEvent('pointermove', {
      pointerId: 5,
      pointerType: 'touch',
      clientX: x,
      clientY: box.y + box.height * 0.6,
    });
    const tip = strip.locator('.edge-strip__tip');
    await expect(tip).toBeVisible();
    await expect(tip).toHaveText(/^Chapter /u);
    await expect(tip).toBeInViewport({ ratio: 1 });
    expect(await seriousViolations(page), 'a scrub’s tip').toEqual([]);
  });
}

// QA (#40, Phase 4d): the strip in pages, where the page turns by a tap in its
// outer third and a finger drawn across it, and the strip stands at that very
// edge. A finger on the strip is the strip's: never a turn, never a jump.
test('a book in pages with its marks on the edge: a finger on the strip never turns the page', async ({
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
  await page.locator('.phone-bar__controls [data-command="look"]').click();
  await page.locator('[data-setting="epub.view"] [data-value="pages"]').click();
  await page.locator('[data-setting="epub.marks"] [data-value="edge"]').click();
  await page.keyboard.press('Escape');
  const leaf = page.locator('.page__leaf--epub');
  await expect(leaf).toHaveAttribute('data-view', 'pages');
  await expect(leaf).toHaveAttribute('data-marks', 'edge');
  const strip = page.locator('.edge-strip');
  const box = await strip.boundingBox();
  const words = await page.locator('.epub-sheet:not([aria-hidden]) .epub__pages').boundingBox();
  if (!box || !words) throw new Error('no strip');
  const first = await firstWords(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  // A tap on it: neither a turn (the page's outer third) nor a jump.
  await page.touchscreen.tap(x, y);
  // A finger drawn leftward from it, across the page: a turn's drag, had it begun on the page.
  await strip.dispatchEvent('pointerdown', {
    pointerId: 9,
    pointerType: 'touch',
    button: 0,
    clientX: x,
    clientY: y,
  });
  await page.evaluate(
    ([from, at]) => {
      const to = (clientX: number) => ({
        pointerId: 9,
        pointerType: 'touch',
        clientX,
        clientY: at,
        bubbles: true,
      });
      window.dispatchEvent(new PointerEvent('pointermove', to(from - 100)));
      window.dispatchEvent(new PointerEvent('pointermove', to(from - 200)));
      window.dispatchEvent(new PointerEvent('pointerup', to(from - 200)));
    },
    [x, y] as const,
  );
  // Long enough for a turn or a chapter drawn to have landed (reduced motion: at once).
  await page.waitForTimeout(500);
  expect(await firstWords(page)).toBe(first);
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  // The pane keeps the strip its room: it never lies over the page's words.
  expect(box.x).toBeGreaterThanOrEqual(words.x + words.width - 1);
  // Reduced motion: the place's bar moves at once.
  expect(
    await strip
      .locator('.edge-strip__here')
      .evaluate((bar) => getComputedStyle(bar).transitionDuration),
  ).toBe('0s');
});

// Set as a book on the phone (#40, Phase 3d): one page always, even a tablet's
// screen one pane at a time with room for two; ragged, as a measure this short
// opens rivers when it's justified, but hyphenated; a chapter opening two
// lines low; Eien's title page before the first chapter all the same.
test('a book in pages on the phone is one page, ragged and hyphenated, on a tablet’s screen too', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(async () => {
    await window.eien.settings.set('appearance.room', 'one');
    await window.eien.settings.set('epub.view', 'pages');
  });
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.reload();
  await expect(page.locator('.shell')).toHaveAttribute('data-phone', '');
  await back(page).click();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  const leaf = page.locator('.page__leaf--epub');
  await expect(leaf).toHaveAttribute('data-view', 'pages');
  const box = page.locator('.epub-sheet:not([aria-hidden]) .epub__pages');
  await expect(box).not.toHaveAttribute('data-spread');
  const set = await box.evaluate((element) => {
    const words = element.querySelector('.epub-chapter') as HTMLElement;
    const paragraph = words.querySelector('p:not([data-part])') as HTMLElement;
    const title = words.querySelector('[data-part="chapter-title"]') as HTMLElement;
    return {
      columns: getComputedStyle(words).columnCount,
      align: getComputedStyle(paragraph).textAlign,
      hyphens: getComputedStyle(words).hyphens,
      sink: Number.parseFloat(getComputedStyle(title).paddingTop),
      line: Number.parseFloat(getComputedStyle(words).lineHeight),
    };
  });
  expect(set.columns).toBe('1');
  expect(set.align).toBe('start');
  expect(set.hyphens).toBe('auto');
  expect(set.sink).toBeCloseTo(2 * set.line, 0);
  // Its running head and folio over and under the page, in the machine's voice.
  await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-heads')).toBeVisible();
  await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-folios')).toBeVisible();
  expect(await seriousViolations(page), 'a book set as a book on the phone').toEqual([]);
  // QA (#40, Phase 3d): tapped back past the book's first page, Eien's imprint, then its title
  // page, one page at a time. In sight, not merely drawn: a page turned away is only clipped.
  const inSight = (part: string) =>
    box.evaluate((element, selector) => {
      const found = element.querySelector(selector)?.getBoundingClientRect();
      const sight = element.getBoundingClientRect();
      return (
        found !== undefined &&
        found.width > 0 &&
        found.left >= sight.left - 1 &&
        found.right <= sight.right + 1
      );
    }, part);
  const rect = await box.boundingBox();
  if (!rect) throw new Error('no page');
  const tapBack = () => page.touchscreen.tap(rect.x + rect.width * 0.1, rect.y + rect.height / 2);
  for (let i = 0; i < 6 && !(await inSight('[aria-label="Imprint"]')); i++) {
    await tapBack();
    await page.waitForTimeout(100);
  }
  await expect.poll(() => inSight('[aria-label="Imprint"]')).toBe(true);
  expect(await inSight('[aria-label="Title page"]')).toBe(false);
  await tapBack();
  await expect.poll(() => inSight('[aria-label="Title page"]')).toBe(true);
  expect(await inSight('[aria-label="Imprint"]')).toBe(false);
  // No page of the book's: none said, nothing to bookmark.
  await expect(page.locator('.colophon__page').first()).toHaveText('');
  expect(await seriousViolations(page), 'Eien’s title page on the phone').toEqual([]);
});

// A curl on two facing pages (#40, Phase 3d): the desktop's panes on a wide
// screen open a spread, and a page turns round the gutter, not the whole
// sheet: on, the right page; back, the left, in a mirror; the other lying
// still until it lands.
test('a curl on two facing pages turns one page round the gutter', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    await window.eien.settings.set('appearance.room', 'panes');
    await window.eien.settings.set('epub.view', 'pages');
    await window.eien.settings.set('epub.turn', 'curl');
    // As slow as a turn goes, to be caught in flight.
    await window.eien.settings.set('epub.turnSpeed', '4');
  });
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 2000, height: 900 });
  await page.reload();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect(chapter(page).first()).toContainText('It is a truth universally acknowledged');
  const box = page.locator('.epub-sheet:not([aria-hidden]) .epub__pages');
  await expect(box).toHaveAttribute('data-spread', '');
  const gutter = await box.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left + rect.width / 2;
  });
  const sheet = await page.locator('.epub-sheet:not([aria-hidden])').boundingBox();
  if (!sheet) throw new Error('no sheet');
  await page.locator('.page__leaf--epub .page__scroll').focus();
  const leafBox = () =>
    page.locator('.turn-curl__leaf').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
  // On: the right page, from the gutter to the sheet's right edge.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.turn-curl__leaf')).toHaveCount(1);
  const on = await leafBox();
  expect(Math.abs(on.left - gutter)).toBeLessThan(2);
  expect(Math.abs(on.right - (sheet.x + sheet.width))).toBeLessThan(2);
  await expect(page.locator('.turn-curl')).toHaveCount(0, { timeout: 10_000 });
  // Back: the left page, from the sheet's left edge to the gutter.
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.turn-curl__leaf')).toHaveCount(1);
  const back = await leafBox();
  expect(Math.abs(back.left - sheet.x)).toBeLessThan(2);
  expect(Math.abs(back.right - gutter)).toBeLessThan(2);
  await expect(page.locator('.turn-curl')).toHaveCount(0, { timeout: 10_000 });
});
