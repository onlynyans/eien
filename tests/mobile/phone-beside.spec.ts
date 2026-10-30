// A book beside a note on a phone and a tablet (#40, Phase 2c): Wide screen's
// Two pages takes a book on its second page as it takes a note, the phone a
// tap away from the other; and Quote from the page's ⋯, into the note
// beside, or with one page, the note you came from.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import { seriousViolations } from '../e2e/axe';
import { open, putBytesOutside, putOutside, readOutside, titles } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

const BOOK = readFileSync(join(import.meta.dirname, '../fixtures/epub/plain.epub')).toString(
  'base64',
);
const TABLET = { width: 1180, height: 820 };
const PHONE = { width: 412, height: 915 };
const back = (page: Page) => page.locator('.phone-bar__back');
const other = (page: Page) => page.locator('.phone-bar__other');
const chapter = (page: Page) => page.locator('.epub-chapter');
const shelfBook = (page: Page) =>
  page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' });

/** The vault with a note and the book, `room` chosen, on `screen`. */
async function withBook(page: Page, room: 'one' | 'pages', screen: typeof TABLET): Promise<void> {
  await open(page);
  await page.evaluate((room) => window.eien.settings.set('appearance.room', room), room);
  await putOutside(page, 'Eien/Vault/Assembly.md', 'She hears it from two chairs away.\n');
  await putBytesOutside(page, 'Eien/Vault/Novels/Pride and Prejudice.epub', BOOK);
  await page.setViewportSize(screen);
  await page.reload();
  await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
}

/** The book's paragraph starting `from`, chosen. */
const choose = (page: Page, from: string) =>
  chapter(page).evaluate((element, words) => {
    const paragraph = [...element.querySelectorAll('p')].find((p) =>
      p.textContent?.startsWith(words),
    );
    const range = document.createRange();
    range.selectNodeContents(paragraph as Node);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  }, from);

const quoteFromMore = async (page: Page) => {
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Quote in the note' }).click();
};

test('Two pages: a book faces the note, folded it’s a tap away, and the ⋯ quotes into the note', async ({
  page,
}) => {
  await withBook(page, 'pages', TABLET);
  await titles(page).filter({ hasText: 'Assembly' }).click();
  await back(page).click(); // the list, back to the sidebar
  await back(page).click();
  await shelfBook(page).click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
  expect(await seriousViolations(page), 'a book facing a note').toEqual([]);
  await choose(page, 'Mr. Bennet replied');
  await quoteFromMore(page);
  await expect
    .poll(() => readOutside(page, 'Eien/Vault/Assembly.md'))
    .toBe(
      'She hears it from two chairs away.\n\n> Mr. Bennet replied that he had not.\n>\n> — Pride and Prejudice, Chapter I\n',
    );
  // Folded: one page, the one you're in; the note a tap away, and back.
  await page.setViewportSize(PHONE);
  await expect(page.locator('.page__pages > .page__leaf:visible')).toHaveCount(1);
  await expect(other(page)).toHaveAccessibleName('Switch to Assembly');
  await other(page).click();
  await expect(page.locator('.page .title')).toHaveText('Assembly');
  await expect(other(page)).toHaveAccessibleName('Switch to Pride and Prejudice');
});

test('one page: the ⋯ quotes into the note you came from, the book a tap away', async ({
  page,
}) => {
  await withBook(page, 'one', PHONE);
  await titles(page).filter({ hasText: 'Assembly' }).click();
  await back(page).click();
  await back(page).click();
  await shelfBook(page).click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  // Read on a way before quoting: the book comes back at this line.
  const scroller = page.locator('.page__leaf--epub .page__scroll');
  await scroller.evaluate((element) => {
    element.scrollTop = 900;
  });
  const inSight = () =>
    scroller.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const at = document.caretRangeFromPoint(box.left + box.width / 2, box.top + 4);
      return at?.startContainer.parentElement?.closest('p')?.textContent?.slice(0, 50) ?? '';
    });
  const left = await inSight();
  await choose(page, 'Mr. Bennet replied');
  await quoteFromMore(page);
  // The note comes back with the quote at its end, said on its colophon; the book a tap away.
  await expect(page.locator('.colophon')).toContainText('Quoted in Assembly.');
  await expect(page.locator('.page .cm-content')).toContainText(
    'Mr. Bennet replied that he had not.',
  );
  await expect
    .poll(() => readOutside(page, 'Eien/Vault/Assembly.md'))
    .toContain('> — Pride and Prejudice, Chapter I');
  await expect(other(page)).toHaveAccessibleName('Switch to Pride and Prejudice');
  await other(page).click();
  await expect(chapter(page)).toContainText('It is a truth universally acknowledged');
  await expect.poll(inSight).toBe(left);
});
