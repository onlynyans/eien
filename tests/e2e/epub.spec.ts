// Books on the shelf (#40, Phase 1): EPUBs in a real vault, made by the
// fixtures' script. SHELF lists them under the folders that hold them, never
// a folder's note list; one opens on the page, its contents in the list, a
// chapter drawn with its pictures; the chapter last open comes back after a
// restart; a hostile book is refused, or drawn with nothing that runs.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { closeApp, expect, launchApp, ROOT, test } from './launch';

const FIXTURES = join(ROOT, 'tests/fixtures/epub');
const epub = (name: string) => new Uint8Array(readFileSync(join(FIXTURES, name)));

const shelfEpub = (page: Page, title: string) =>
  page.locator('.tree-row--epub .tree-row__name').filter({ hasText: title });
const chapter = (page: Page) => page.locator('.page__leaf--epub .epub-chapter');

test.describe('the shelf', () => {
  test.use({
    vaultFiles: {
      'Novels/Pride and Prejudice.epub': epub('plain.epub'),
      'Novels/Persuasion.md': 'Notes on Persuasion.\n',
      'Fic/Research/Plates.epub': epub('plates.epub'),
      'Fic/Draft.md': 'A draft.\n',
      'Hostile/Locked.epub': epub('drm.epub'),
      'Hostile/Script.epub': epub('script.epub'),
      'Hostile/Bomb.epub': epub('bomb.epub'),
    },
  });

  test('lists the books under the folders that hold them, between FOLDERS and TAGS', async ({
    page,
  }) => {
    await expect(page.locator('.section__label')).toHaveText([
      'Library',
      'Folders',
      'Shelf',
      'Tags',
    ]);
    await expect(shelfEpub(page, 'Pride and Prejudice')).toBeVisible();
    await expect(shelfEpub(page, 'Plates')).toBeVisible();
    await expect(page.locator('.tree-row--shelf-folder')).toHaveText([
      'Fic',
      'Research',
      'Hostile',
      'Novels',
    ]);
    // A folder's list holds its notes, never its books.
    await page
      .locator('.tree-row__name')
      .filter({ hasText: /^Novels/ })
      .first()
      .click();
    await expect(page.locator('.list__body .note-row')).toHaveText([/Persuasion/]);
  });

  test('opens a book on the page, its contents in the list, a chapter with its picture', async ({
    page,
  }) => {
    await shelfEpub(page, 'Pride and Prejudice').click();
    await expect(shelfEpub(page, 'Pride and Prejudice')).toHaveAttribute('aria-current', 'true');
    // The list shows the book's contents: no row under LIBRARY, FOLDERS or TAGS is the one chosen.
    await expect(page.locator('.sidebar [aria-current="true"]')).toHaveCount(1);
    await expect(page.locator('.list__heading')).toHaveText('Pride and Prejudice');
    const rows = page.locator('.contents-row');
    await expect(rows).toHaveText(['Chapter I', 'Chapter II', 'Chapter III']);
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    await expect(rows.first()).toHaveAttribute('aria-current', 'true');
    await rows.nth(2).click();
    await expect(chapter(page)).toContainText('Not all that Mrs. Bennet');
    await expect(rows.nth(2)).toHaveAttribute('aria-current', 'true');
    const picture = chapter(page).locator('img');
    await expect(picture).toHaveAttribute('src', /^blob:/u);
    await expect
      .poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expect(page.locator('.colophon__chapter')).toHaveText('4 of 4');
    // The keyboard moves between the contents' rows.
    await rows.nth(2).focus();
    await page.keyboard.press('ArrowUp');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(chapter(page)).toContainText('Mr. Bennet was among the earliest');
    // Choosing a folder brings its notes back to the list; the book stays on the page.
    await page
      .locator('.tree-row__name')
      .filter({ hasText: /^Novels/ })
      .first()
      .click();
    await expect(page.locator('.list__body .note-row')).toHaveText([/Persuasion/]);
    await expect(chapter(page)).toContainText('Mr. Bennet was among the earliest');
  });

  test('unwraps a plate framed in SVG, and draws a picture alone on its page', async ({ page }) => {
    await shelfEpub(page, 'Plates').click();
    const picture = chapter(page).locator('[data-part="plate"] img');
    await expect(picture).toHaveAttribute('alt', 'He rode a black horse.');
    await page.locator('.contents-row').nth(1).click();
    await expect(chapter(page).locator('[data-part="plate"] img')).toHaveAttribute(
      'src',
      /^blob:/u,
    );
    await expect(chapter(page).locator('svg')).toHaveCount(0);
  });

  test('refuses a locked book and a zip bomb, and says why', async ({ page }) => {
    await shelfEpub(page, 'Locked').click();
    await expect(page.locator('.page__leaf--epub .notice')).toHaveText(/locked with DRM/u);
    await expect(chapter(page)).toBeEmpty();
    await shelfEpub(page, 'Bomb').click();
    await expect(page.locator('.page__leaf--epub .notice')).toHaveText(/too large/u);
  });

  test('draws a chapter with script and handlers in it with nothing that runs', async ({
    page,
  }) => {
    await shelfEpub(page, 'Script').click();
    await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
    for (const selector of [
      'script',
      'iframe',
      'object',
      'form',
      'style',
      'svg',
      '[onclick]',
      '[onmouseover]',
      '[style]',
      'a[href]',
    ]) {
      await expect(chapter(page).locator(selector), selector).toHaveCount(0);
    }
    await expect(chapter(page)).toContainText('[A remote picture]');
    expect(await page.evaluate(() => (window as { eienRan?: boolean }).eienRan)).toBeUndefined();
  });
});

test.describe('the chapter kept', () => {
  test.use({ vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') } });

  test('comes back after a restart, from .eien/reading, the book’s file never written', async ({
    page,
    vault,
    userData,
    app,
  }) => {
    if (!vault) throw new Error('no vault');
    await shelfEpub(page, 'Pride and Prejudice').click();
    await page.locator('.contents-row').nth(1).click();
    await expect(chapter(page)).toContainText('Mr. Bennet was among the earliest');
    const reading = join(vault, '.eien/reading');
    await expect
      .poll(() => readdirSync(reading).filter((name) => name.endsWith('.json')))
      .toHaveLength(1);
    const [file] = readdirSync(reading);
    expect(JSON.parse(readFileSync(join(reading, file as string), 'utf8'))).toEqual({
      version: 1,
      chapter: 'OEBPS/chapter-2.xhtml',
    });
    await closeApp(app);
    const again = await launchApp(userData, vault);
    const next = await again.firstWindow();
    await shelfEpub(next, 'Pride and Prejudice').click();
    await expect(chapter(next)).toContainText('Mr. Bennet was among the earliest');
    expect(readFileSync(join(vault, 'Novels/Pride and Prejudice.epub'))).toEqual(
      Buffer.from(epub('plain.epub')),
    );
    await closeApp(again);
  });
});

test.describe('a book’s folder renamed', () => {
  test.use({ vaultFiles: { 'Novels/Pride and Prejudice.epub': epub('plain.epub') } });

  test('keeps the book open on its page, under the folder’s new name', async ({ page }) => {
    await shelfEpub(page, 'Pride and Prejudice').click();
    await page.locator('.contents-row').nth(1).click();
    await expect(chapter(page)).toContainText('Mr. Bennet was among the earliest');
    // A folder of books alone is on SHELF only, and renamed in its row there.
    await expect(page.locator('[data-key="folder:Novels"]')).toHaveCount(0);
    const folder = page.locator('[data-key="shelf:Novels"]');
    await folder.focus();
    await page.keyboard.press('F2');
    await expect(page.locator('#sidebar-shelf .tree-row__field')).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Austen');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-key="shelf:Austen"]')).toBeFocused();
    await expect(page.locator('.page__leaf--epub .crumbs')).toHaveText('Austen');
    await expect(chapter(page)).toContainText('Mr. Bennet was among the earliest');
    await expect(page.locator('.contents-row').nth(1)).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('the menu bar', () => {
  test.use({
    vaultFiles: {
      'Novels/Pride and Prejudice.epub': epub('plain.epub'),
      'Notes.md': 'A note of my own.\n',
    },
  });

  /** Whether the menu bar's item for `command` is on (each item's id is its command). */
  const enabled = (app: ElectronApplication, ...commands: string[]) =>
    app.evaluate(
      ({ Menu }, ids) => ids.map((id) => Menu.getApplicationMenu()?.getMenuItemById(id)?.enabled),
      commands,
    );
  const NOTES = ['seal', 'view:live', 'compare', 'copy-html', 'format:bold', 'export-note:pdf'];
  const ANY = ['find', 'look', 'new-note', 'split', 'export-book:epub'];

  test('greys a note’s commands while a book is in front, and gives them back with a note', async ({
    app,
    page,
  }) => {
    await page.locator('.note-row', { hasText: 'Notes' }).click();
    await expect
      .poll(() => enabled(app, ...NOTES, ...ANY))
      .toEqual([...NOTES, ...ANY].map(() => true));
    await shelfEpub(page, 'Pride and Prejudice').click();
    await expect(chapter(page)).toContainText('It is a truth');
    await expect.poll(() => enabled(app, ...NOTES)).toEqual(NOTES.map(() => false));
    expect(await enabled(app, ...ANY)).toEqual(ANY.map(() => true));
    // A menu of the bar still opens, its items greyed; Export Note's submenu greys with them.
    const menus = await app.evaluate(({ Menu }) =>
      (Menu.getApplicationMenu()?.items ?? []).map((menu) => [menu.label, menu.enabled] as const),
    );
    expect(menus.every(([, on]) => on)).toBe(true);
    const exportNote = await app.evaluate(
      ({ Menu }) =>
        Menu.getApplicationMenu()
          ?.items.find((menu) => menu.label === 'File')
          ?.submenu?.items.find((item) => item.label === 'Export Note')?.enabled,
    );
    expect(exportNote).toBe(false);
    await page.locator('.tree-row__name', { hasText: /^All Notes/u }).click();
    await page.locator('.note-row', { hasText: 'Notes' }).click();
    await expect.poll(() => enabled(app, ...NOTES)).toEqual(NOTES.map(() => true));
  });
});
