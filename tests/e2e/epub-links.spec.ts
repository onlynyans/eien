// A book's own links and notes (#40, Phase 2b), in the built app on the
// fixture books: a link goes to its chapter and place and Back returns, a
// note's reference shows the note over the page, a hostile book's links go
// nowhere and run nothing, and a copy from a book holds its words alone.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { expect, ROOT, test } from './launch';

const epub = (name: string) =>
  new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/epub', name)));
const shelfEpub = (page: Page, title: string) =>
  page.locator('.tree-row--epub .tree-row__name').filter({ hasText: title });
const chapter = (page: Page) => page.locator('.page__leaf--epub .epub-chapter');
const scroller = (page: Page) => page.locator('.page__leaf--epub .page__scroll');
const note = (page: Page) => page.locator('.epub-note');

/** What the system clipboard holds, as text and as HTML. */
const clipboardOf = (app: ElectronApplication) =>
  app.evaluate(async ({ clipboard }) => {
    const items = await clipboard.read();
    const item = items.find((one) => one.types.includes('text/html'));
    const html = item ? await ((await item.getType('text/html')) as Blob).text() : '';
    return { text: await clipboard.readText(), html };
  });

test.use({
  vaultFiles: {
    'Books/Links.epub': epub('links.epub'),
    'Books/Notes.epub': epub('notes.epub'),
    'Books/Hostile.epub': epub('links-hostile.epub'),
  },
});

test('a link goes to its chapter and place, and Back returns to the line it left', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await shelfEpub(page, 'Links').click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  const top = await scroller(page).evaluate((element) => element.scrollTop);
  await chapter(page).getByRole('link', { name: 'see Chapter III' }).click();
  await expect(chapter(page)).toContainText('Sir William had been delighted');
  // The span's place at the scroller's top, not the chapter's.
  await expect
    .poll(() => scroller(page).evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  const back = page.locator('.colophon').getByRole('button', { name: 'Back to Chapter I' });
  await back.click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  await expect.poll(() => scroller(page).evaluate((element) => element.scrollTop)).toBe(top);
  await expect(back).toBeHidden();
  // Nothing of the book moved the window: its address is the same.
  expect(await page.evaluate(() => location.hash)).toBe('');
});

test('a note’s reference shows the note over the page; Esc closes it, the keyboard back on the mark', async ({
  page,
}) => {
  await shelfEpub(page, 'Links').click();
  const mark = chapter(page).locator('sup a[href]');
  await mark.click();
  const dialog = page.getByRole('dialog', { name: 'Note 1' });
  await expect(dialog).toContainText('The novel’s first sentence, and its most quoted.');
  await expect(dialog).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(note(page)).toHaveCount(0);
  await expect(mark).toBeFocused();
  // Eien's own export's footnotes, in the same chapter; Go to the note goes there. The window
  // short, so the reference is out of sight: pressing it scrolls it in, and the note stays.
  await page.setViewportSize({ width: 1280, height: 420 });
  await shelfEpub(page, 'Notes').click();
  const below = chapter(page).locator('a[data-part="note-ref"]').nth(1);
  expect(await below.evaluate((a) => a.getBoundingClientRect().top > window.innerHeight)).toBe(
    true,
  );
  await below.click();
  await expect(note(page)).toContainText('Netherfield Park, let to Mr. Bingley.');
  await note(page).getByRole('button', { name: 'Go to the note' }).click();
  await expect(note(page)).toHaveCount(0);
  await expect(page.locator('.colophon').getByRole('button', { name: /^Back to/u })).toBeVisible();
});

test('a hostile book’s links go nowhere and run nothing', async ({ page }) => {
  await shelfEpub(page, 'Hostile').click();
  await expect(chapter(page)).toContainText('way 0');
  // Only the web's keeps its address (for the system's browser); the rest stay words, unstyled.
  for (const n of [0, 2, 3, 4, 5, 6, 7]) {
    await expect(chapter(page).getByText(`way ${n}`, { exact: true })).not.toHaveAttribute(
      'href',
      /./u,
    );
  }
  await expect(chapter(page).getByText('way 1', { exact: true })).toHaveAttribute(
    'href',
    'https://example.com/',
  );
  await expect(chapter(page).locator('[id], [name], script, [onclick]')).toHaveCount(0);
  await chapter(page).getByText('Back to the top.').click();
  await chapter(page).locator('a[data-part="note-ref"]').first().click();
  await expect(note(page)).toHaveCount(0);
  expect(await page.evaluate(() => (window as { eienRan?: boolean }).eienRan)).toBeUndefined();
  expect(await page.evaluate(() => location.hash)).toBe('');
});

test('a web link opens in the system’s browser, named in the tooltip, the window staying put', async ({
  app,
  page,
}) => {
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    Object.assign(globalThis, { opened });
    shell.openExternal = async (url) => void opened.push(url);
  });
  await shelfEpub(page, 'Hostile').click();
  const web = chapter(page).getByText('way 1', { exact: true });
  await expect(web).toHaveAttribute('data-tip', 'example.com/');
  // Its look: the words' own colour, a quiet underline.
  expect(
    await web.evaluate((a) => getComputedStyle(a).textDecorationLine.includes('underline')),
  ).toBe(true);
  // Reached from the keyboard, its tooltip names where it goes at once (a hover's comes after a pause).
  await page.keyboard.press('Shift');
  await web.focus();
  await expect(page.locator('.tooltip')).toHaveText('example.com/');
  await web.click();
  await expect
    .poll(() => app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened))
    .toEqual(['https://example.com/']);
  expect(await page.evaluate(() => location.href)).not.toContain('example.com');
  // A chapter's link names its chapter, for the same tooltip.
  await shelfEpub(page, 'Links').click();
  await expect(chapter(page).getByRole('link', { name: 'see Chapter III' })).toHaveAttribute(
    'data-tip',
    'Chapter III',
  );
});

test('a copy from a book holds its words, without its marks or addresses', async ({
  app,
  page,
}) => {
  await shelfEpub(page, 'Notes').click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  await chapter(page).evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
  });
  await page.keyboard.press('ControlOrMeta+c');
  await expect
    .poll(async () => (await clipboardOf(app)).text)
    .toContain('It is a truth universally acknowledged');
  const { text, html } = await clipboardOf(app);
  expect(text).not.toMatch(/wife\.\s*1/u);
  expect(html).not.toMatch(/href|data-|blob:/u);
});
