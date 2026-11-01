// A book's tools in every room (#63): One at a time, Side by side and Two
// pages draw the layout's phone tools, which hold a book's own (Pages and
// Scroll, the bookmark) as Panes' bars do, set aside while a note is in front.
// And the phone's bar holds them, with the note you came from, on a narrow phone.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import { open, putBytesOutside, putOutside, titles } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');
const PHONE = { width: 412, height: 915 };
/** A Galaxy Z Fold 5 opened upright, as the other phone specs size it. */
const FOLD5_UPRIGHT = { width: 590, height: 706 };
/** The phone's tools: in its bar (A's), or at the page's foot (B's slip, C's rail). */
const tools = (page: Page) => page.locator('.phone-bar__controls, .page__phone');
const back = (page: Page) => page.locator('.phone-bar__back');

/** The vault with a note and a book, the room and layout chosen; the note opened, then the book. */
async function noteThenBook(
  page: Page,
  room: 'one' | 'side' | 'pages',
  layout: 'band' | 'slip' | 'runhead',
  screen: { width: number; height: number },
): Promise<void> {
  await open(page);
  await page.evaluate(
    async ([room, layout]) => {
      await window.eien.settings.set('appearance.room', room);
      await window.eien.settings.set('appearance.layout', layout);
    },
    [room, layout] as const,
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

// A book's tools are one more than a note's in A's bar, beside the back word and the note you
// came from (⇄): on the narrowest phones (a Fold 5's cover, 344px; many Galaxies, 360) every
// control is in the bar, none over another, and back stays a finger's reach.
for (const screen of [{ width: 344, height: 882 }, { width: 360, height: 800 }, PHONE]) {
  test(`${screen.width}px: the book’s tools, back and the note you came from fit the bar`, async ({
    page,
  }) => {
    await noteThenBook(page, 'one', 'band', screen);
    await expect(page.locator('.phone-bar__other')).toBeVisible();
    const drawn = await page.locator('.phone-bar').evaluate((bar) => {
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
        back: bar.querySelector('.phone-bar__back')?.getBoundingClientRect().width ?? 0,
        over: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(drawn.outside).toEqual([]);
    expect(drawn.overlapping).toEqual([]);
    expect(drawn.over).toBe(0);
    expect(drawn.back).toBeGreaterThanOrEqual(44);
  });
}
