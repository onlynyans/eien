// A book's bookmarks (#40, Phase 4b): B or the tool bookmarks the page in
// sight, which wears the Page mark (ribbon, dog-ear or edge tab), kept in
// .eien/reading across a restart; in Pages, only the bookmarked page wears
// it; in a split in Facing pages, the mark keeps saying "the page you're in"
// and the book's folio says "bookmarked" instead.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Locator, Page } from '@playwright/test';
import { seriousViolations } from './axe';
import { ALONE, chooseSetting, clickMenu, closeApp, expect, launchApp, ROOT, test } from './launch';

const epub = (name: string) =>
  new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/epub', name)));

const shelfEpub = (page: Page) =>
  page.locator('.tree-row--epub .tree-row__name').filter({ hasText: 'Pride and Prejudice' });
const leaf = (page: Page) => page.locator('.page__leaf--epub');
const mark = (page: Page) => leaf(page).locator('.page__mark--bookmark[data-edge="right"]');
const tool = (page: Page) => page.locator('[data-command="bookmark"]:visible').first();

/** The bookmarks in the reading state's one file in `vault`. */
function bookmarksIn(vault: string): { chapter: string; offset: number; words: string }[] {
  const folder = join(vault, '.eien/reading');
  if (!existsSync(folder)) return [];
  const [file] = readdirSync(folder).filter((name) => name.endsWith('.json'));
  return file ? (JSON.parse(readFileSync(join(folder, file), 'utf8')).bookmarks ?? []) : [];
}

async function openBook(page: Page): Promise<void> {
  await shelfEpub(page).click();
  await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
  await leaf(page).locator('.page__scroll').focus();
}

test.describe('a book’s bookmarks', () => {
  test.use({
    vaultFiles: {
      'Novels/Pride and Prejudice.epub': epub('plain.epub'),
      'Notes.md': 'Snow on the walls.\n',
    },
  });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('B bookmarks the page, its mark and tool say so, and it’s there after a restart', async ({
    page,
    app,
    vault,
    userData,
  }) => {
    if (!vault) throw new Error('no vault');
    await openBook(page);
    await expect(mark(page)).toBeHidden();
    await expect(tool(page)).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    await expect(tool(page)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => bookmarksIn(vault).length).toBe(1);
    expect(bookmarksIn(vault)[0]?.words).toMatch(/It is a truth/u);
    await closeApp(app);
    const again = await launchApp(userData, vault);
    const next = await again.firstWindow();
    await next.setViewportSize({ width: 1600, height: 900 });
    await openBook(next);
    await expect(mark(next)).toBeVisible();
    // The tool takes it off.
    await tool(next).click();
    await expect(mark(next)).toBeHidden();
    await expect.poll(() => bookmarksIn(vault).length).toBe(0);
    await closeApp(again);
  });

  test('wears each of the three Page marks', async ({ page }) => {
    await openBook(page);
    await page.keyboard.press('b');
    for (const kind of ['ribbon', 'dogear', 'tab'] as const) {
      await chooseSetting(page, 'appearance.facingMark', kind);
      await expect(page.locator('html')).toHaveAttribute('data-facing-mark', kind);
      await expect(mark(page)).toBeVisible();
      const box = await mark(page).boundingBox();
      const sheet = await leaf(page).locator('.epub-sheet').boundingBox();
      if (!box || !sheet) throw new Error('nothing in sight');
      // At the sheet's outer edge, its top.
      expect(box.x + box.width / 2).toBeGreaterThan(sheet.x + sheet.width / 2);
      expect(box.y).toBeLessThan(sheet.y + sheet.height / 4);
    }
  });

  test('keeps to the top of the sheet in sight as the chapter scrolls', async ({ page }) => {
    await openBook(page);
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    // Scrolled a little, its lines still in sight: the mark stands at the scroller's top.
    await leaf(page)
      .locator('.page__scroll')
      .evaluate((element) => {
        element.scrollTop = 60;
      });
    const scroller = await leaf(page).locator('.page__scroll').boundingBox();
    await expect
      .poll(async () => {
        const box = await mark(page).boundingBox();
        return box && scroller ? Math.abs(box.y - scroller.y) : Number.POSITIVE_INFINITY;
      })
      .toBeLessThan(4);
  });

  test('in pages, keeps its page across a restart', async ({ page, app, vault, userData }) => {
    if (!vault) throw new Error('no vault');
    await openBook(page);
    await page.locator('[data-command="view.pages"]:visible').first().click();
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    await expect.poll(() => bookmarksIn(vault).length).toBe(1);
    await closeApp(app);
    const again = await launchApp(userData, vault);
    const next = await again.firstWindow();
    await next.setViewportSize({ width: 1600, height: 900 });
    await openBook(next);
    await expect(mark(next)).toBeVisible();
    await next.keyboard.press('ArrowLeft');
    await expect(mark(next)).toBeHidden();
    await closeApp(again);
  });

  test('in pages, only the bookmarked page wears it', async ({ page, app }) => {
    await openBook(page);
    await page.locator('[data-command="view.pages"]:visible').first().click();
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(mark(page)).toBeHidden();
    await page.keyboard.press('ArrowLeft');
    await expect(mark(page)).toBeVisible();
    // The menu bar's View → Bookmark This Page takes it off.
    await clickMenu(app, 'View', 'Bookmark This Page');
    await expect(mark(page)).toBeHidden();
  });
});

test.describe('Marks in the list (Phase 4c)', () => {
  test.use({
    vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') },
  });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('lists the bookmarks under Marks, a row going to its page, Delete taking it off', async ({
    page,
  }) => {
    await openBook(page);
    // A bookmark in the third chapter, then back at the first.
    await page.locator('.contents-row').nth(2).click();
    await expect(leaf(page).locator('.epub-chapter')).toContainText('Not all that Mrs. Bennet');
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    await page.getByRole('button', { name: /^Marks \d+$/u }).click();
    await expect(page.getByRole('button', { name: /^Marks \d+$/u })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const row = page.locator('.mark-row');
    await expect(row).toHaveCount(1);
    await expect(row.locator('.mark-row__words')).toContainText('Not all that Mrs. Bennet');
    await expect(row.locator('.mark-row__chapter')).toHaveText('Chapter III · bookmark');
    await expect(row.locator('.mark-row__page')).toHaveText(/^\d+$/u);
    await page.getByRole('button', { name: /^Contents \d+$/u }).click();
    await page.locator('.contents-row').nth(0).click();
    await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
    await page.getByRole('button', { name: /^Marks \d+$/u }).click();
    await row.click();
    await expect(leaf(page).locator('.epub-chapter')).toContainText('Not all that Mrs. Bennet');
    await expect(mark(page)).toBeVisible();
    await row.focus();
    await page.keyboard.press('Delete');
    await expect(row).toHaveCount(0);
    await expect(page.locator('.list__empty')).toHaveText(
      'Nothing kept yet. B bookmarks a page; H keeps the words you choose.',
    );
    await expect(mark(page)).toBeHidden();
  });

  test('lists them under the book’s row with two panes', async ({ page }) => {
    await page.locator('[data-command="panes"]').click();
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
    await openBook(page);
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    await page
      .locator('.tree-lenses')
      .getByRole('button', { name: /^Marks \d+$/u })
      .click();
    const row = page.locator('.tree-row--mark .tree-row__name');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('It is a truth');
    expect(await seriousViolations(page), 'Marks under a book on SHELF').toEqual([]);
    // Another chapter, then the row goes back to the bookmark's.
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('End');
    await row.click();
    await expect(mark(page)).toBeVisible();
    // Delete takes it off; the tree says none is kept.
    await row.focus();
    await page.keyboard.press('Delete');
    await expect(row).toHaveCount(0);
    await expect(page.locator('.tree-hint')).toHaveText(
      'Nothing kept yet. B bookmarks a page; H keeps the words you choose.',
    );
    await expect(mark(page)).toBeHidden();
  });

  // QA's (Phase 4c): the keys as a real keyboard sends them, a held key's repeats among them.
  test('Delete hands the keyboard to the next row and takes one off however long it’s held; ⌘⌫ takes none off and trashes nothing', async ({
    page,
    vault,
  }) => {
    if (!vault) throw new Error('no vault');
    await openBook(page);
    // A bookmark at the top of each chapter, Chapter I first.
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    for (const [n, words] of [
      [1, 'Mr. Bennet was among the earliest'],
      [2, 'Not all that Mrs. Bennet'],
    ] as const) {
      await page.locator('.contents-row').nth(n).click();
      await expect(leaf(page).locator('.epub-chapter')).toContainText(words);
      await leaf(page).locator('.page__scroll').focus();
      await page.keyboard.press('b');
      await expect(mark(page)).toBeVisible();
    }
    await expect.poll(() => bookmarksIn(vault).length).toBe(3);
    await page.getByRole('button', { name: /^Marks \d+$/u }).click();
    const rows = page.locator('.mark-row');
    await expect(rows.locator('.mark-row__chapter')).toHaveText([
      'Chapter I · bookmark',
      'Chapter II · bookmark',
      'Chapter III · bookmark',
    ]);
    // Delete on the first: the keyboard goes to the row now first, Chapter II's.
    await rows.nth(0).focus();
    await page.keyboard.press('Delete');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toBeFocused();
    await expect(rows.nth(0).locator('.mark-row__chapter')).toHaveText('Chapter II · bookmark');
    // Held down: the first press takes Chapter II's off, the repeats nothing.
    await page.keyboard.down('Delete');
    await page.keyboard.down('Delete');
    await page.keyboard.down('Delete');
    await page.keyboard.up('Delete');
    await expect.poll(() => bookmarksIn(vault).length).toBe(1);
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toBeFocused();
    // ⌘⌫ (Ctrl+Backspace) and Ctrl+Delete: a note's row's trash keys, never this row's.
    await page.keyboard.press('ControlOrMeta+Backspace');
    await page.keyboard.press('ControlOrMeta+Delete');
    // B on the page (Chapter III, bookmarked) waits behind any change those made: it takes its
    // bookmark off, leaving none, only if they took off nothing.
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('b');
    await expect.poll(() => bookmarksIn(vault).length).toBe(0);
    await expect(page.locator('.list__empty')).toHaveText(
      'Nothing kept yet. B bookmarks a page; H keeps the words you choose.',
    );
    await expect(shelfEpub(page)).toBeVisible();
    expect(existsSync(join(vault, 'Novels/Pride and Prejudice.epub'))).toBe(true);
  });
});

test.describe('Marks on the edge (Phase 4d)', () => {
  test.use({
    vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') },
    deviceFile: { settings: { 'epub.marks': 'edge' } },
  });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('the list is the contents alone; the strip shows the book, its bookmarks, and goes', async ({
    page,
  }) => {
    await openBook(page);
    await expect(page.getByRole('tab', { name: /Marks/u })).toHaveCount(0);
    await expect(page.locator('.contents-row')).toHaveCount(3);
    const strip = page.getByRole('slider', { name: 'The whole book' });
    await expect(strip).toBeVisible();
    await expect(strip).toHaveAttribute('aria-valuetext', /^Chapter I/u);
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('b');
    await expect(strip.locator('.edge-strip__mark')).toHaveCount(1);
    // Its keys: a chapter on, then the book's end.
    await strip.focus();
    await page.keyboard.press('ArrowDown');
    await expect(leaf(page).locator('.epub-chapter')).toContainText('Mr. Bennet was among');
    await page.keyboard.press('Home');
    await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
    // A click near its foot: the last chapter.
    const box = await strip.boundingBox();
    if (!box) throw new Error('no strip');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 3);
    await expect(strip.locator('.edge-strip__tip')).toHaveText(/^Chapter III/u);
    await page.mouse.down();
    await page.mouse.up();
    await expect(leaf(page).locator('.epub-chapter')).toContainText('Not all that Mrs. Bennet');
    expect(await seriousViolations(page), 'the strip').toEqual([]);
    // Marks back in the list, from the shelf's look: the list's buttons come back, the strip goes.
    await page.locator('[data-command="look"]:not(.phone-bar__controls *, .page__phone *)').click();
    await page.locator('[data-setting="epub.marks"] [data-value="list"]').click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /^Marks \d+$/u })).toBeVisible();
    await expect(strip).toBeHidden();
  });
});

test.describe('a bookmark in Facing pages', () => {
  test.use({
    vaultFiles: {
      'Novels/Pride and Prejudice.epub': epub('plain.epub'),
      'Notes.md': 'Snow on the walls.\n',
    },
    deviceFile: { settings: { 'appearance.split': 'facing' } },
  });

  test('wears no mark there, its folio saying “bookmarked”, its tool pressed', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.locator('.note-row', { hasText: 'Notes' }).click();
    await shelfEpub(page).click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
    await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('b');
    const folio = leaf(page).locator('.page__folio');
    await expect(folio.locator('.colophon__bookmarked')).toHaveText('bookmarked');
    await expect(folio.locator('.colophon__bookmarked')).toBeVisible();
    // The facing mark keeps its meaning: one mark, the active page's; the bookmark's not drawn.
    await expect(mark(page)).toBeHidden();
    await expect(page.locator('.page__mark--active')).toHaveCount(1);
    await expect(folio.locator('[data-command="bookmark"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await seriousViolations(page), 'a bookmarked book in Facing pages').toEqual([]);
    // Closed to one page by a narrower window, still no bookmark mark.
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(page.locator('.page__pages[data-narrow="close"]')).toHaveCount(1);
    await expect(mark(page)).toBeHidden();
  });
});

// QA (#40, Phase 4b): the cases above leave out. Written, not run here (the owner's rule: no
// Electron window on the owner's screen); CI runs them.

/** Whether the menu bar's item for `command` is on (each item's id is its command). */
const menuOn = (app: ElectronApplication, command: string) =>
  app.evaluate(({ Menu }, id) => Menu.getApplicationMenu()?.getMenuItemById(id)?.enabled, command);

/** Whether a word visually hidden (1px, clipped: heard, not seen) is out of sight. */
const unseen = async (locator: Locator) => ((await locator.boundingBox())?.width ?? 0) <= 1;

test.describe('a bookmark, QA', () => {
  test.use({
    vaultFiles: {
      'Novels/Pride and Prejudice.epub': epub('plain.epub'),
      'Notes.md': 'Snow on the walls.\n',
    },
  });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('View → Bookmark This Page is greyed with a note in front, on with a book', async ({
    app,
    page,
  }) => {
    await page.locator('.note-row', { hasText: 'Notes' }).click();
    await expect(page.locator('.title')).toHaveText('Notes');
    await expect.poll(() => menuOn(app, 'bookmark')).toBe(false);
    // B in the note is a letter typed, never a bookmark.
    await page.locator('.cm-content').click();
    await page.keyboard.press('End');
    await page.keyboard.press('b');
    await expect(page.locator('.cm-content')).toContainText('walls.b');
    await openBook(page);
    await expect.poll(() => menuOn(app, 'bookmark')).toBe(true);
    await clickMenu(app, 'View', 'Bookmark This Page');
    await expect(mark(page)).toBeVisible();
  });

  test('arrives with the mark’s own motion, and with none when motion is reduced', async ({
    page,
  }) => {
    await chooseSetting(page, 'appearance.facingMark', 'ribbon');
    await openBook(page);
    const duration = () =>
      mark(page).evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).animationDuration),
      );
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    expect(await duration()).toBeGreaterThan(0);
    await page.keyboard.press('b');
    await expect(mark(page)).toBeHidden();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    expect(await duration()).toBe(0);
  });

  test('the edge tab stands inside the page’s edge with Page frame Full', async ({ page }) => {
    await chooseSetting(page, 'appearance.facingMark', 'tab');
    await openBook(page);
    // A book wears its own frame, the shelf's look's (Settings sets notes').
    await page.locator('[data-command="look"]:not(.phone-bar__controls *, .page__phone *)').click();
    await page
      .getByRole('dialog', { name: 'Look: Shelf' })
      .locator('[data-setting="appearance.frame"] [data-value="full"]')
      .click();
    await page.keyboard.press('Escape');
    await expect(leaf(page)).toHaveAttribute('data-frame', 'full');
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    const box = await mark(page).boundingBox();
    const sheet = await leaf(page).locator('.epub-sheet').boundingBox();
    const scroller = await leaf(page).locator('.page__scroll').boundingBox();
    if (!box || !sheet || !scroller) throw new Error('nothing in sight');
    // In sight: within the sheet and the page's scroller both, at the outer (right) edge.
    expect(box.x + box.width).toBeLessThanOrEqual(sheet.x + sheet.width + 1);
    expect(box.x + box.width).toBeLessThanOrEqual(scroller.x + scroller.width + 1);
    expect(box.x).toBeGreaterThan(sheet.x + sheet.width / 2);
  });

  test('in pages, the edge tab stands past the fore-edge’s pages still to read', async ({
    page,
  }) => {
    await chooseSetting(page, 'appearance.facingMark', 'tab');
    await openBook(page);
    await page.locator('[data-command="view.pages"]:visible').first().click();
    await leaf(page).locator('.page__scroll').focus();
    const edges = leaf(page).locator('.epub-edges__stack--after .epub-edges__edge');
    await expect(edges).not.toHaveCount(0);
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    const box = await mark(page).boundingBox();
    if (!box) throw new Error('no mark');
    const furthest = Math.max(
      ...(await edges.evaluateAll((all) => all.map((edge) => edge.getBoundingClientRect().right))),
    );
    // Never under the stack: its inner side at or past the last paper edge.
    expect(box.x).toBeGreaterThanOrEqual(furthest - 1);
  });
});

test.describe('a bookmark as a page turns, QA', () => {
  test.use({
    vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') },
    // The slowest curl, so a key lands while it's in flight.
    deviceFile: { settings: { 'epub.view': 'pages', 'epub.turn': 'curl', 'epub.turnSpeed': '4' } },
  });
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('B mid-turn lands the turn and bookmarks the page it lands on', ALONE, async ({ page }) => {
    await openBook(page);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.turn-curl')).toHaveCount(1);
    await page.keyboard.press('b');
    await expect(page.locator('.turn-curl')).toHaveCount(0);
    await expect(mark(page)).toBeVisible();
    // The page it left has none: the bookmark is the second page's.
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.turn-curl')).toHaveCount(1);
    // Never drawn while a page curls (the turning page is a copy, which leaves it out).
    await expect(mark(page)).toBeHidden();
    await expect(page.locator('.turn-curl')).toHaveCount(0, { timeout: 10_000 });
    await expect(mark(page)).toBeHidden();
    await expect(tool(page)).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('a bookmark in a Companion, QA', () => {
  test.use({
    vaultFiles: {
      'Novels/Pride and Prejudice.epub': epub('plain.epub'),
      'Notes.md': 'Snow on the walls.\n',
    },
    deviceFile: { settings: { 'appearance.split': 'companion' } },
  });

  test('wears its mark there, as anywhere but Facing pages, the folio’s word unseen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.locator('.note-row', { hasText: 'Notes' }).click();
    await shelfEpub(page).click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
    await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
    await leaf(page).locator('.page__scroll').focus();
    await page.keyboard.press('b');
    await expect(mark(page)).toBeVisible();
    const box = await mark(page).boundingBox();
    const sheet = await leaf(page).locator('.epub-sheet').boundingBox();
    if (!box || !sheet) throw new Error('nothing in sight');
    // At the top of the companion's sheet, its outer side.
    expect(box.y).toBeLessThan(sheet.y + sheet.height / 4);
    expect(box.x + box.width / 2).toBeGreaterThan(sheet.x + sheet.width / 2);
    expect(await unseen(leaf(page).locator('.colophon__bookmarked'))).toBe(true);
    expect(await seriousViolations(page), 'a bookmarked book as a companion').toEqual([]);
  });
});

for (const scheme of ['day', 'night'] as const) {
  test.describe(`the clash in Facing pages by ${scheme}, QA`, () => {
    test.use({
      vaultFiles: {
        'Novels/Pride and Prejudice.epub': epub('plain.epub'),
        'Notes.md': 'Snow on the walls.\n',
      },
      deviceFile: { settings: { 'appearance.split': 'facing', 'appearance.scheme': scheme } },
    });

    test('the folio says “bookmarked” whichever page is active, and closed to one, with no serious violation', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.locator('.note-row', { hasText: 'Notes' }).click();
      await shelfEpub(page).click({ modifiers: ['ControlOrMeta'] });
      await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
      await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
      await leaf(page).locator('.page__scroll').focus();
      await page.keyboard.press('b');
      const word = leaf(page).locator('.page__folio .colophon__bookmarked');
      await expect(word).toHaveText('bookmarked');
      expect(await unseen(word)).toBe(false);
      // The note made the active page: the book still wears no mark, its folio still says so.
      const noteLeaf = page.locator('.page__leaf:not(.page__leaf--epub)');
      await noteLeaf.locator('.cm-content').click();
      const noteSide = (await noteLeaf.getAttribute('data-side')) ?? '';
      await expect(page.locator('.page__pages')).toHaveAttribute('data-active-side', noteSide);
      await expect(mark(page)).toBeHidden();
      expect(await unseen(word)).toBe(false);
      expect(await seriousViolations(page), 'the clash, the note active').toEqual([]);
      // Closed to one page: still the folio's word, never the mark.
      await leaf(page).locator('.page__scroll').focus();
      await page.setViewportSize({ width: 1000, height: 800 });
      await expect(page.locator('.page__pages[data-narrow="close"]')).toHaveCount(1);
      await expect(mark(page)).toBeHidden();
      expect(await unseen(word)).toBe(false);
      expect(await seriousViolations(page), 'the clash, closed to one').toEqual([]);
    });
  });
}
