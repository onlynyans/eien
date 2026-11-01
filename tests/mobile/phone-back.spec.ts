// Android's back through the panes (#70), and a finger swiped across a book
// in Scroll turning the chapter (#71). Real touches (CDP's), so the browser's
// own scroll runs under the finger; the back button as Capacitor's App
// plugin hears it.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import { catchBackButton, open, putBytesOutside, putOutside, swipe, systemBack } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
test.beforeEach(({ page }) => catchBackButton(page));

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');
/** A tablet turned sideways: room for three panes. */
const TABLET = { width: 1180, height: 820 };
const list = (page: Page) => page.locator('.shell > .list');
const shell = (page: Page) => page.locator('.shell');
const back = (page: Page) => page.locator('.phone-bar__back');
const chapterAt = (page: Page) => page.locator('.colophon__chapter');

test('with the panes shut, back opens the list, then the sidebar, then leaves the window as it is', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(async () => {
    await window.eien.settings.set('appearance.room', 'panes');
    await window.eien.settings.set('layout.panes', 'three');
  });
  await putOutside(page, 'Eien/Vault/Fic/Tear.md', 'The words.\n');
  await page.setViewportSize(TABLET);
  await page.locator('.note-row__title', { hasText: 'Tear' }).click();
  // Both shut, by the layout's own tools.
  await page.locator('[data-command="pane.list"]:visible').first().click();
  await page.locator('[data-command="pane.sidebar"]:visible').first().click();
  await expect(list(page)).toHaveAttribute('inert', '');
  await expect(shell(page)).toHaveAttribute('data-sidebar-shut', '');
  await systemBack(page);
  await expect(list(page)).not.toHaveAttribute('inert', '');
  await expect(shell(page)).toHaveAttribute('data-sidebar-shut', '');
  await systemBack(page);
  await expect(shell(page)).not.toHaveAttribute('data-sidebar-shut');
  // Nothing left to open: Android's own (the app steps aside); the panes stay.
  await systemBack(page);
  await expect(list(page)).not.toHaveAttribute('inert', '');
  await expect(shell(page)).not.toHaveAttribute('data-sidebar-shut');
});

/** A book open in Scroll, one pane at a time. */
async function bookInScroll(page: Page): Promise<void> {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await back(page).click();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect(page.locator('.page__leaf--epub')).toHaveAttribute('data-view', 'scroll');
  await expect(chapterAt(page)).toHaveText(/^2 of \d+$/u);
}

test('a finger swiped across a book in Scroll turns the chapter, and back returns to the place', async ({
  page,
}) => {
  await bookInScroll(page);
  const sheet = await page.locator('.epub-sheet').boundingBox();
  if (!sheet) throw new Error('no page');
  const cdp = await page.context().newCDPSession(page);
  const y = 300;
  // Leftward, well inside the screen: the next chapter.
  await swipe(
    cdp,
    { x: sheet.x + sheet.width * 0.8, y },
    { x: sheet.x + sheet.width * 0.2, y },
    10,
  );
  await expect(chapterAt(page)).toHaveText(/^3 of \d+$/u);
  await expect(page.getByRole('button', { name: 'Back to Chapter I' })).toBeVisible();
  // The system's back takes the book's own step first, then the pane.
  await systemBack(page);
  await expect(chapterAt(page)).toHaveText(/^2 of \d+$/u);
  await systemBack(page);
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'list');
});

test('a finger drawn down a book in Scroll scrolls it, and never turns the chapter', async ({
  page,
}) => {
  await bookInScroll(page);
  const sheet = await page.locator('.epub-sheet').boundingBox();
  if (!sheet) throw new Error('no page');
  const scroller = page.locator('.page__leaf--epub .page__scroll');
  const top = await scroller.evaluate((element) => element.scrollTop);
  const cdp = await page.context().newCDPSession(page);
  const x = sheet.x + sheet.width / 2;
  // Up the page, drifting sideways as a thumb does.
  await swipe(cdp, { x: x + 60, y: 600 }, { x: x - 60, y: 250 }, 10);
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(top);
  await page.waitForTimeout(300);
  await expect(chapterAt(page)).toHaveText(/^2 of \d+$/u);
});
