// A book's tools in every room (#63): One at a time, Side by side and Two
// pages draw the layout's phone tools, which hold a book's own (Pages and
// Scroll, the bookmark, Marks) as Panes' bars do, set aside while a note is in
// front, and Find, every page's (#64). And the phone's bar holds them, with
// the note you came from, on a narrow phone: short of room its tools fold into
// the ⋯, which offers them all.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import { open, putBytesOutside, putOutside, titles } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');
const PHONE = { width: 412, height: 915 };
/** A Galaxy Z Fold 5 opened upright, as the other phone specs size it. */
const FOLD5_UPRIGHT = { width: 590, height: 706 };
/** A tablet on its side: room for two pages facing. */
const TABLET = { width: 1180, height: 820 };
/** The phone's tools: in its bar (A's), or at the page's foot (B's slip, C's rail). */
const tools = (page: Page) => page.locator('.phone-bar__controls, .page__phone');
const back = (page: Page) => page.locator('.phone-bar__back');

/** The vault with a note and a book, the room and layout chosen; the note opened, then the book. */
async function noteThenBook(
  page: Page,
  room: 'one' | 'side' | 'pages',
  layout: 'band' | 'slip' | 'runhead',
  screen: { width: number; height: number },
  marks: 'list' | 'edge' = 'list',
): Promise<void> {
  await open(page);
  await page.evaluate(
    async ([room, layout, marks]) => {
      await window.eien.settings.set('appearance.room', room);
      await window.eien.settings.set('appearance.layout', layout);
      await window.eien.settings.set('epub.marks', marks);
    },
    [room, layout, marks] as const,
  );
  await putOutside(page, 'Eien/Vault/Notes.md', 'Notes on the book.\n');
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await page.setViewportSize(screen);
  await page.reload();
  await expect(page.locator('.shell')).toHaveAttribute('data-room', room);
  await expect(titles(page)).toHaveCount(1, { timeout: 10_000 });
  await titles(page).first().click();
  await expect(page.locator('.page .title').first()).toHaveText('Notes');
  const book = page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' });
  // Back to the shelf, a pane or two away.
  for (let step = 0; step < 3 && !(await book.isVisible()); step++) await back(page).click();
  await book.click();
  await expect(page.locator('.epub-chapter')).toContainText('It is a truth universally');
}

const ROOMS = [
  ['one', PHONE],
  ['side', FOLD5_UPRIGHT],
  ['pages', FOLD5_UPRIGHT],
] as const;

for (const [room, screen] of ROOMS) {
  for (const layout of ['band', 'slip', 'runhead'] as const) {
    test(`${room}, ${layout}: a book’s bar has Pages, Scroll and the bookmark, which bookmarks`, async ({
      page,
    }) => {
      await noteThenBook(page, room, layout, screen);
      const bar = tools(page);
      for (const name of ['Pages', 'Scroll', 'Bookmark this page', 'Look'])
        await expect(bar.getByRole('button', { name, exact: true })).toBeVisible();
      await expect(bar.getByRole('button', { name: 'Focus mode' })).toBeHidden(); // a note's
      const bookmark = bar.getByRole('button', { name: 'Bookmark this page', exact: true });
      await bookmark.click();
      await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
      await bar.getByRole('button', { name: 'Scroll', exact: true }).click();
      await expect(page.locator('.page__leaf--epub')).toHaveAttribute('data-view', 'scroll');
    });
  }
}

// Two pages, the note and the book facing: the phone's tools are the active page's, the book's
// set aside while the note is chosen, and back with the book.
for (const layout of ['band', 'slip', 'runhead'] as const) {
  test(`pages, ${layout}: the tools follow the page chosen, a note or the book`, async ({
    page,
  }) => {
    await noteThenBook(page, 'pages', layout, TABLET);
    await expect(page.locator('.page__leaf--epub')).toBeVisible();
    await expect(page.locator('.page .cm-content')).toBeVisible(); // the note, facing
    const bar = tools(page);
    const bookmark = bar.getByRole('button', { name: 'Bookmark this page', exact: true });
    const pages = bar.getByRole('button', { name: 'Pages', exact: true });
    const focus = bar.getByRole('button', { name: 'Focus mode' });
    await expect(bookmark).toBeVisible();
    await page.locator('.page .cm-content').click();
    await expect(focus).toBeVisible();
    await expect(bookmark).toBeHidden();
    await expect(pages).toBeHidden();
    await page.locator('.epub-chapter').click();
    await expect(bookmark).toBeVisible();
    await expect(pages).toBeVisible();
    await expect(focus).toBeHidden();
  });
}

/** Every control in sight in the phone's bar and at the page's foot: none past its bar or over another. */
const drawnIn = (page: Page) =>
  page.locator('.shell').evaluate((shell) =>
    [...shell.querySelectorAll<HTMLElement>('.phone-bar, .page__phone')].map((bar) => {
      const box = bar.getBoundingClientRect();
      const controls = [...bar.querySelectorAll<HTMLElement>('button')]
        .filter((button) => button.checkVisibility())
        .map((button) => ({
          name: button.getAttribute('aria-label') ?? button.textContent ?? '',
          box: button.getBoundingClientRect(),
        }));
      return {
        outside: controls
          .filter(({ box: at }) => at.left < box.left - 0.5 || at.right > box.right + 0.5)
          .map(({ name }) => name),
        overlapping: controls.flatMap((one, at) =>
          controls
            .slice(at + 1)
            .filter(({ box }) => box.left < one.box.right - 0.5 && one.box.left < box.right - 0.5)
            .map(({ name }) => `${one.name} over ${name}`),
        ),
        back: bar.querySelector('.phone-bar__back')?.getBoundingClientRect().width ?? 44,
        over: document.documentElement.scrollWidth - innerWidth,
      };
    }),
  );

/** Nothing past its bar or over another, nothing past the screen, back a finger's reach. */
async function fits(page: Page): Promise<void> {
  for (const drawn of await drawnIn(page)) {
    expect(drawn.outside).toEqual([]);
    expect(drawn.overlapping).toEqual([]);
    expect(drawn.over).toBe(0);
    expect(drawn.back).toBeGreaterThanOrEqual(44);
  }
}

/** What the page's ⋯ offers, by name. */
async function inMore(page: Page): Promise<string[]> {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const names = await page.locator('.menu [role^="menuitem"]').allTextContents();
  await page.keyboard.press('Escape');
  return names.map((name) => name.trim());
}

// On the narrowest phones (a Fold 5's cover, 344px; many Galaxies, 360) beside the back word and
// the note you came from (⇄), in every layout: every control in its bar, none over another, back
// a finger's reach; what didn't fit folded into the ⋯, which offers it (#64).
for (const layout of ['band', 'slip', 'runhead'] as const) {
  for (const screen of [{ width: 344, height: 882 }, { width: 360, height: 800 }, PHONE]) {
    test(`${layout}, ${screen.width}px: a book’s tools and a note’s fit, back and the note you came from too`, async ({
      page,
    }) => {
      await noteThenBook(page, 'one', layout, screen);
      await expect(page.locator('.phone-bar__other')).toBeVisible();
      await fits(page);
      // The book's views and the ⋯ never fold; what did, the ⋯ offers.
      const bar = tools(page);
      for (const name of ['Pages', 'Scroll', 'More'])
        await expect(bar.getByRole('button', { name, exact: true })).toBeVisible();
      const more = await inMore(page);
      for (const name of ['Find', 'Bookmark this page', 'Marks', 'Look'])
        expect(more).toContain(name);
      // The ⋯'s Marks does what the bar's does: the book's marks, a pane away.
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await page.locator('.menu [role^="menuitem"]', { hasText: /^Marks$/u }).click();
      await expect(page.locator('.book-lens[aria-pressed="true"]').first()).toContainText('Marks');
      // Back to the page by a chapter of its contents.
      await page.getByRole('button', { name: /^Contents/u }).click();
      await page.locator('.contents-row').first().click();
      await expect(page.locator('.epub-chapter')).toBeVisible();
      // The note you came from, a tap away: its tools fit as well.
      await page.locator('.phone-bar__other').click();
      await expect(page.locator('.page .title').first()).toHaveText('Notes');
      await fits(page);
      await expect(bar.getByRole('button', { name: 'More', exact: true })).toBeVisible();
    });
  }
}

// Find and Marks among a book's tools (#64): Find the page's own find bar, Marks the book's marks
// where they're listed, a pane away on a phone.
for (const layout of ['band', 'slip', 'runhead'] as const) {
  test(`${layout}: Find opens the book’s find bar, Marks its marks`, async ({ page }) => {
    // Room for every tool beside back and the note you came from.
    await noteThenBook(page, 'one', layout, FOLD5_UPRIGHT);
    const bar = tools(page);
    await bar.getByRole('button', { name: 'Find', exact: true }).click();
    const find = page.getByRole('search', { name: 'Find in the book' });
    await expect(find).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(find).toBeHidden();
    await bar.getByRole('button', { name: 'Marks', exact: true }).click();
    await expect(page.locator('.shell')).not.toHaveAttribute('data-shown', 'page');
    await expect(page.locator('.book-lens[aria-pressed="true"]').first()).toContainText('Marks');
  });
}

test('a note has Find among its tools too, and no Marks', async ({ page }) => {
  await noteThenBook(page, 'one', 'band', PHONE);
  await page.locator('.phone-bar__other').click();
  await expect(page.locator('.page .title').first()).toHaveText('Notes');
  const bar = tools(page);
  await expect(bar.getByRole('button', { name: 'Marks', exact: true })).toBeHidden();
  await bar.getByRole('button', { name: 'Find', exact: true }).click();
  await expect(page.getByRole('search', { name: 'Find in the note' })).toBeVisible();
});

test('with marks on the edge, the strip is the marks: Marks set aside, in the bar and the ⋯', async ({
  page,
}) => {
  await noteThenBook(page, 'one', 'band', FOLD5_UPRIGHT, 'edge');
  const bar = tools(page);
  await expect(bar.getByRole('button', { name: 'Marks', exact: true })).toBeHidden();
  await expect(bar.getByRole('button', { name: 'Find', exact: true })).toBeVisible();
  expect(await inMore(page)).not.toContain('Marks');
});
