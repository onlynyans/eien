// Android's back through the panes (#70), and a finger swiped across a book
// in Scroll turning the chapter (#71). Real touches (CDP's), so the browser's
// own scroll runs under the finger; the back button as Capacitor's App
// plugin hears it.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import {
  catchBackButton,
  open,
  putBytesOutside,
  putOutside,
  swipe,
  systemBack,
  threePanes,
} from './outside';

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
  await page.evaluate(() => window.eien.settings.set('appearance.room', 'panes'));
  await threePanes(page); // the note list too (a phone starts with two, #69), read as the window starts
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

test('a thumb that scrolls a book, then drifts across, scrolled it: the chapter stays', async ({
  page,
}) => {
  await bookInScroll(page);
  const sheet = await page.locator('.epub-sheet').boundingBox();
  if (!sheet) throw new Error('no page');
  const scroller = page.locator('.page__leaf--epub .page__scroll');
  const top = await scroller.evaluate((element) => element.scrollTop);
  const cdp = await page.context().newCDPSession(page);
  const x = sheet.x + sheet.width * 0.8;
  const point = (at: { x: number; y: number }) => [
    { ...at, id: 1, radiusX: 4, radiusY: 4, force: 1 },
  ];
  // Up the page first, so the browser scrolls it; then, the scroll under way, well across.
  const path = [
    ...Array.from({ length: 8 }, (_, i) => ({ x, y: 500 - (i + 1) * 12 })),
    ...Array.from({ length: 10 }, (_, i) => ({ x: x - (i + 1) * sheet.width * 0.06, y: 404 })),
  ];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point({ x, y: 500 }),
  });
  for (const at of path)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(at) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(top);
  await page.waitForTimeout(300);
  await expect(chapterAt(page)).toHaveText(/^2 of \d+$/u);
});

/** Count Android's step aside (the App plugin's minimizeApp, on every instance catchBackButton caught). */
const countStepsAside = (page: Page) =>
  page.evaluate(() => {
    const counted = window as unknown as { __webPlugins: object[]; __asides: number };
    counted.__asides = 0;
    for (const plugin of counted.__webPlugins as { minimizeApp?: () => Promise<void> }[])
      if (plugin.minimizeApp)
        plugin.minimizeApp = async () => {
          counted.__asides += 1;
        };
  });
const stepsAside = (page: Page) =>
  page.evaluate(() => (window as unknown as { __asides: number }).__asides);

test('Android’s back steps Eien aside only when nothing in it went back', async ({ page }) => {
  await open(page);
  await putOutside(page, 'Eien/Vault/Fic/Tear.md', 'The words.\n');
  await page.locator('.note-row__title', { hasText: 'Tear' }).click();
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'page');
  await countStepsAside(page);
  await systemBack(page); // the page to the list
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'list');
  await systemBack(page); // the list to the sidebar
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'sidebar');
  expect(await stepsAside(page)).toBe(0);
  await systemBack(page); // nothing left: Android's own
  await expect.poll(() => stepsAside(page)).toBe(1);
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'sidebar');
});

/**
 * The page given a desktop's window bridge as it loads, where the Mac says two fingers swipe
 * between pages: so the window takes back as a trackpad's gesture (#70), wheel and all.
 */
const asDesktopWindow = (page: Page) =>
  page.addInitScript(() => {
    const define = Object.defineProperty;
    Object.defineProperty = ((target: object, key: PropertyKey, about: PropertyDescriptor) => {
      if (target === window && key === 'eien' && about.value) {
        Object.defineProperty = define;
        const desktop = {
          open: async () => {},
          close: async () => {},
          start: async () => ({ note: null }),
          greyMenu: async () => {},
          swipes: async () => true,
        };
        return define(target, key, { ...about, value: { ...about.value, window: desktop } });
      }
      return define(target, key, about);
    }) as typeof Object.defineProperty;
  });

test('a trackpad’s two fingers swiped back open a pane, and press no Esc: the search stays', async ({
  page,
}) => {
  await asDesktopWindow(page);
  await open(page);
  await page.evaluate(() => window.eien.settings.set('appearance.room', 'panes'));
  await threePanes(page); // the note list too (a phone starts with two, #69), read as the window starts
  await putOutside(page, 'Eien/Vault/Fic/Tear.md', 'The words, the words.\n');
  await page.setViewportSize(TABLET);
  await page.locator('.note-row__title', { hasText: 'Tear' }).click();
  await page.locator('[data-command="pane.list"]:visible').first().click();
  await expect(list(page)).toHaveAttribute('inert', '');
  // With the list shut, the search field is the sidebar's: words typed there, the keyboard in it.
  const search = page.locator('input[type="search"]:visible');
  await search.fill('words');
  await expect(search).toBeFocused();
  const box = await page.locator('.cm-content').boundingBox();
  if (!box) throw new Error('no page');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // Sideways across the page, as a trackpad's wheel (the device's pixels: Pixel 7's are 2.625 to a CSS one).
  for (let step = 0; step < 12; step += 1) await page.mouse.wheel(-60, 0);
  await expect(list(page)).not.toHaveAttribute('inert', '');
  await expect(page.locator('input[type="search"]:visible')).toHaveValue('words');
});
