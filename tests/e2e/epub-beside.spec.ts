// A book beside a note (#40, Phase 2c): opened beside from its row on SHELF
// (⌘-click, its menu's Open to the Side), the split takes a book on one page
// as it takes a note, in each of its modes, with nothing made for books: ⇄
// and the pager folded. And Quote: words chosen in
// the book go into the note beside as a Markdown quote with the book's title
// and chapter under them, one ⌘Z in the note taking them out.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { clickMenu, expect, ROOT, readQuietly, test } from './launch';

const BOOK = new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/epub/plain.epub')));
const NOTE = 'At the Assembly.md';

const leaves = (page: Page) => page.locator('.page__pages > .page__leaf');
const book = (page: Page) => page.locator('.page__leaf--epub');
const chapter = (page: Page) => book(page).locator('.epub-chapter');
const note = (page: Page) => page.locator('.page__leaf:not(.page__leaf--epub) .cm-content');

const shelfBook = (page: Page) =>
  page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' });

/** A note on one page, and the book opened beside it from its row on SHELF (⌘-click, as a note's). */
async function beside(page: Page): Promise<void> {
  await page.locator('.note-row', { hasText: 'At the Assembly' }).click();
  await shelfBook(page).click({ modifiers: ['ControlOrMeta'] });
  await expect(leaves(page)).toHaveCount(2);
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  await expect(note(page)).toContainText('She hears it from two chairs away.');
}

/** The book's paragraph starting `from` chosen, as a hand would choose it. */
const choose = (page: Page, from: string) =>
  chapter(page).evaluate((element, words) => {
    const paragraph = [...element.querySelectorAll('p')].find((p) =>
      p.textContent?.startsWith(words),
    );
    if (!paragraph) throw new Error(`no paragraph starts “${words}”`);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
  }, from);

test.use({
  vaultFiles: {
    'Novels/Pride and Prejudice.epub': BOOK,
    [NOTE]: 'She hears it from two chairs away.\n',
  },
});
test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

for (const mode of ['sheets', 'facing', 'companion', 'follow'] as const) {
  test.describe(`${mode}`, () => {
    test.use({ deviceFile: { settings: { 'appearance.split': mode } } });

    test('lays a book out beside a note, ⇄ swapping them, each in its place', async ({
      app,
      page,
    }) => {
      await beside(page);
      await expect(page.locator('html')).toHaveAttribute('data-split', mode);
      await expect(chapter(page)).toBeVisible();
      await expect(note(page)).toBeVisible();
      const bookAt = await leaves(page).evaluateAll((all) =>
        all.findIndex((leaf) => leaf.classList.contains('page__leaf--epub')),
      );
      await clickMenu(app, 'View', 'Swap Pages');
      await expect
        .poll(() =>
          leaves(page).evaluateAll((all) =>
            all.findIndex((leaf) => leaf.classList.contains('page__leaf--epub')),
          ),
        )
        .toBe(1 - bookAt);
      await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
      await expect(note(page)).toContainText('She hears it from two chairs away.');
    });
  });
}

test('a book’s row menu opens it to the side of the note', async ({ page }) => {
  await page.locator('.note-row', { hasText: 'At the Assembly' }).click();
  await shelfBook(page).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open to the Side' }).click();
  await expect(leaves(page)).toHaveCount(2);
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  await expect(note(page)).toContainText('She hears it from two chairs away.');
});

test('folded, the pager names the book and the note, and turns to either', async ({ page }) => {
  await beside(page);
  await page.setViewportSize({ width: 1000, height: 800 });
  const pager = page.getByRole('group', { name: 'The two pages' });
  await expect(pager.getByRole('button')).toHaveText(['At the Assembly', 'Pride and Prejudice']);
  await pager.getByRole('button', { name: 'At the Assembly' }).click();
  await expect(note(page)).toBeVisible();
  await pager.getByRole('button', { name: 'Pride and Prejudice' }).click();
  await expect(chapter(page)).toBeVisible();
});

test('Quote puts the words chosen in the note beside, with the book and chapter, one ⌘Z taking them out', async ({
  page,
  vault,
}) => {
  if (!vault) throw new Error('no vault');
  await beside(page);
  await chapter(page).click({ position: { x: 4, y: 4 } }); // in the book
  await choose(page, 'Mr. Bennet replied');
  // The selection bar, as the mouse leaves a selection.
  await chapter(page).dispatchEvent('mouseup');
  const bar = page.getByRole('toolbar', { name: 'The selection' });
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Quote in the note' }).click();
  const quote =
    'She hears it from two chairs away.\n\n> Mr. Bennet replied that he had not.\n>\n> — Pride and Prejudice, Chapter I\n';
  await expect.poll(() => readQuietly(join(vault, NOTE))).toBe(quote);
  await expect(page.locator('.colophon')).toContainText('Quoted in At the Assembly.');
  // The keyboard stayed in the book; Q quotes again.
  await choose(page, '“But it is,” returned she');
  await book(page).locator('.page__scroll').press('q');
  await expect.poll(() => readQuietly(join(vault, NOTE))).toContain('> “But it is,” returned she');
  // ⌘Z in the note: the last quote out, in one step, the first still there.
  await note(page).click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => readQuietly(join(vault, NOTE))).toBe(quote);
});

test('with no note beside, Quote says where to open one', async ({ page }) => {
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  await choose(page, 'Mr. Bennet replied');
  await book(page).locator('.page__scroll').press('q');
  await expect(page.locator('.colophon')).toContainText(
    'Open a note beside the book to quote into it.',
  );
});
