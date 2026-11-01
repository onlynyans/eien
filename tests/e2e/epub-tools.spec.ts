// The tools, by what's in sight (#40, decided 2026-10-29): a tool shows only
// while the active page can use it. A book alone sets the note's tools aside,
// the formatting bar's row too; beside a note, choosing the book sets the
// note's buttons aside and keeps the row, so neither page moves; choosing
// the note brings them back. A set-aside tool's key does nothing on a book.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { type Box, boxOf, clickMenu, expect, ROOT, test } from './launch';

const PLAIN = readFileSync(join(ROOT, 'tests/fixtures/epub/plain.epub'));
const book = (page: Page) =>
  page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' });
const chapter = (page: Page) => page.locator('.page__leaf--epub .epub-chapter');
const tool = (page: Page, id: string) =>
  page.locator(`[data-command="${id}"]:not(.phone-bar__controls *, .page__phone *)`);
const noteRow = (page: Page, title: string) =>
  page.locator('.note-row').filter({ has: page.locator('.note-row__title', { hasText: title }) });

test.use({
  vaultFiles: {
    'Novels/Pride and Prejudice.epub': PLAIN,
    'Notes.md': 'Notes on the book.\n',
    'Other.md': 'Another note.\n',
  },
  deviceFile: { settings: { 'editor.formatBar': 'on' } },
});

test('a book alone sets a note’s tools aside, and the formatting bar’s row with them', async ({
  page,
}) => {
  await noteRow(page, 'Notes').click();
  await expect(tool(page, 'seal')).toBeVisible();
  await expect(page.locator('.page__format')).toBeVisible();
  await book(page).click();
  await expect(chapter(page)).toContainText('It is a truth');
  for (const id of ['seal', 'compare', 'versions', 'focus', 'format.bold']) {
    await expect(tool(page, id), id).toBeHidden();
  }
  await expect(page.locator('.page__format')).toBeHidden();
  // The tools every page shares stay.
  await expect(tool(page, 'look')).toBeVisible();
});

test('beside a note, choosing the book sets the note’s buttons aside and moves nothing; the note brings them back', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await noteRow(page, 'Notes').click();
  await noteRow(page, 'Other').click({ modifiers: ['ControlOrMeta'] });
  await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
  await book(page).click(); // the active page, Other's, takes the book
  await expect(chapter(page)).toContainText('It is a truth');
  const note = page.locator('.page__pages > .page__leaf:not(.page__leaf--epub)');
  const books = page.locator('.page__leaf--epub');
  const where = async (): Promise<Box[]> => [
    await boxOf(page.locator('.page__format')),
    await boxOf(note),
    await boxOf(books),
  ];

  // The book active: the note's tools set aside, the row kept, nothing moved.
  await expect(books).toHaveAttribute('data-active', '');
  await expect(tool(page, 'format.bold')).toBeHidden();
  await expect(tool(page, 'seal')).toBeHidden();
  await expect(page.locator('.page__format')).toBeVisible();
  const withBook = await where();

  // The note chosen: they come back, still where they were.
  await note.click();
  await expect(note).toHaveAttribute('data-active', '');
  await expect(tool(page, 'format.bold')).toBeVisible();
  await expect(tool(page, 'seal')).toBeVisible();
  expect(await where()).toEqual(withBook);

  // And go again with the book.
  await books.click();
  await expect(tool(page, 'format.bold')).toBeHidden();
  expect(await where()).toEqual(withBook);
});

test('a set-aside tool’s key does nothing on a book beside a note', async ({ page, vault }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await noteRow(page, 'Notes').click();
  await noteRow(page, 'Other').click({ modifiers: ['ControlOrMeta'] });
  await book(page).click();
  await expect(chapter(page)).toContainText('It is a truth');
  await page.locator('.page__leaf--epub').click();
  for (const key of ['ControlOrMeta+b', 'ControlOrMeta+e', 'ControlOrMeta+s']) {
    await page.keyboard.press(key);
  }
  // Nothing written to the note beside, nothing sealed, and the book still on its page.
  await expect(chapter(page)).toContainText('It is a truth');
  expect(readFileSync(join(vault ?? '', 'Notes.md'), 'utf8')).toBe('Notes on the book.\n');
  await expect(page.locator('.page__leaf--epub')).toHaveAttribute('data-active', '');
});

test.describe('with a companion', () => {
  // The pages one under the other, and the interface twice its size in a window kept clear of
  // the phone's width: the bar's tools fold, never the split, on any machine's fonts.
  test.use({
    deviceFile: {
      settings: { 'editor.formatBar': 'on', 'appearance.split': 'companion', 'window.zoom': 200 },
    },
  });

  test('the bar’s ⋯ fits again as choosing the book sets tools aside, and as the note’s brings them back', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await noteRow(page, 'Notes').click();
    await noteRow(page, 'Other').click({ modifiers: ['ControlOrMeta'] });
    await book(page).click();
    await expect(chapter(page)).toContainText('It is a truth');
    const note = page.locator('.page__pages > .page__leaf:not(.page__leaf--epub)');
    const books = page.locator('.page__leaf--epub');
    await expect(note).toBeVisible();
    await expect(books).toBeVisible();
    const more = page.locator('.page__format .host__more');
    await note.click();
    await expect(note).toHaveAttribute('data-active', '');
    // The note's tools folded behind the formatting bar's ⋯, both pages in sight.
    await expect(more).toBeVisible();
    await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
    // The book chosen: the note's buttons set aside, nothing left to fold, the ⋯ goes.
    await books.click();
    await expect(books).toHaveAttribute('data-active', '');
    await expect(more).toBeHidden();
    // The note chosen again: they're back, and fold again as before.
    await note.click();
    await expect(more).toBeVisible();
  });
});

test('a book’s Find opens its find bar, and its Marks the list on its Marks lens, a shut list opened (#64)', async ({
  app,
  page,
}) => {
  await book(page).click();
  await expect(chapter(page)).toContainText('It is a truth');
  await tool(page, 'find').click();
  const find = page.getByRole('search', { name: 'Find in the book' });
  await expect(find).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(find).toBeHidden();
  // The list shut: Marks opens it on the book's marks.
  await clickMenu(app, 'View', 'Toggle Note List');
  await expect(page.locator('.list')).toBeHidden();
  await tool(page, 'marks').click();
  await expect(page.locator('.list')).toBeVisible();
  await expect(page.locator('.list .book-lens[aria-pressed="true"]')).toContainText('Marks');
});

test('a note has Find among its tools too, and no Marks (#64)', async ({ page }) => {
  await noteRow(page, 'Notes').click();
  await expect(tool(page, 'marks')).toBeHidden();
  await tool(page, 'find').click();
  await expect(page.getByRole('search', { name: 'Find in the note' })).toBeVisible();
});
