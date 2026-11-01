// A book's tools in every room (#63): One at a time, Side by side and Two
// pages draw the layout's phone tools, which hold a book's own (Pages and
// Scroll, the bookmark, Marks) as Panes' bars do, set aside while a note is in
// front, and Find, every page's (#64). And the phone's bar holds them, with
// the note you came from, on a narrow phone: short of room its tools fold into
// the ⋯, which offers them all.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, type Page, test } from '@playwright/test';
import { open, putBytesOutside, putOutside, removeOutside, titles } from './outside';

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

/** The tools folded into the ⋯ now. */
const folded = (page: Page) =>
  tools(page)
    .locator('[data-command][hidden]')
    .evaluateAll((buttons) => buttons.map((button) => (button as HTMLElement).dataset.command));

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

// A phone's bar folds what doesn't fit into its ⋯ as its room is now (#64): narrower, more folds;
// back at the width it had, the same as there before (its room read with every tool in sight, back
// and ⇄ giving way first); turned on its side, every tool comes back out of the ⋯.
for (const layout of ['band', 'slip', 'runhead'] as const) {
  test(`${layout}: what folds follows the phone's width, narrower, wider again and turned`, async ({
    page,
  }) => {
    const upright = { width: 344, height: 882 };
    await noteThenBook(page, 'one', layout, upright);
    await expect(page.locator('.phone-bar__other')).toBeVisible();
    const first = await folded(page);
    await page.setViewportSize({ width: 300, height: 882 });
    await expect.poll(async () => (await folded(page)).length).toBeGreaterThan(first.length);
    await fits(page);
    await page.setViewportSize(upright);
    await expect.poll(() => folded(page)).toEqual(first);
    await page.setViewportSize({ width: upright.height, height: upright.width });
    await expect.poll(() => folded(page)).toEqual([]);
    for (const name of ['Bookmark this page', 'Marks', 'Find', 'Look'])
      await expect(tools(page).getByRole('button', { name, exact: true })).toBeVisible();
    await fits(page);
    await page.setViewportSize(upright);
    await expect.poll(() => folded(page)).toEqual(first);
    await fits(page);
  });
}

// The note you came from gone (deleted on another device), its ⇄ goes from A's bar: the room it
// gave back is the tools' again, and what it made fold comes back out of the ⋯.
test('band: the note you came from gone, the tools its ⇄ folded come back', async ({ page }) => {
  await noteThenBook(page, 'one', 'band', { width: 344, height: 882 });
  await expect(page.locator('.phone-bar__other')).toBeVisible();
  const beside = await folded(page);
  expect(beside.length).toBeGreaterThan(0);
  await removeOutside(page, 'Eien/Vault/Notes.md');
  await expect(page.locator('.phone-bar__other')).toBeHidden({ timeout: 10_000 });
  await expect.poll(async () => (await folded(page)).length).toBeLessThan(beside.length);
  await fits(page);
});

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

/** On a tablet with the desktop's panes, `chosen` set: a note and a book in the vault. */
async function onTablet(page: Page, chosen: Record<string, string>): Promise<void> {
  await open(page);
  await page.evaluate(async (chosen) => {
    await window.eien.settings.set('appearance.room', 'panes');
    for (const [key, value] of Object.entries(chosen))
      await window.eien.settings.set(key as never, value as never);
  }, chosen);
  await putOutside(page, 'Eien/Vault/Notes.md', 'Notes on the book.\n');
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await page.setViewportSize(TABLET);
  await page.reload();
  await expect(page.locator('.shell')).toHaveAttribute('data-room', 'panes');
}

const shelfBook = (page: Page) =>
  page.locator('.sidebar .tree-row--epub', { hasText: 'Pride and Prejudice' });
const marksTool = (page: Page) => page.locator('.shell [data-command="marks"]:visible');
const lensOn = (page: Page, where: '.sidebar' | '.list') =>
  page.locator(`${where} .book-lens[aria-pressed="true"]`);

// With the desktop's panes (#64): two panes have no list, so Marks shows the book's marks on its
// SHELF row, the sidebar opened if it was shut.
test('two panes: Marks shows the book’s marks on its SHELF row, a shut sidebar opened', async ({
  page,
}) => {
  await onTablet(page, { 'layout.panes': 'two' });
  await shelfBook(page).locator('.tree-row__name').click();
  await expect(page.locator('.epub-chapter')).toContainText('It is a truth universally');
  await expect(lensOn(page, '.sidebar')).toHaveText(/^Contents/u);
  await marksTool(page).click();
  await expect(lensOn(page, '.sidebar')).toHaveText(/^Marks/u);
  // Back to its contents, the sidebar shut: Marks opens it on the marks again.
  await page.locator('.sidebar .book-lens', { hasText: 'Contents' }).click();
  await page.getByRole('button', { name: 'Hide sidebar' }).first().click();
  await expect(page.locator('.shell > .sidebar')).toBeHidden();
  await marksTool(page).click();
  await expect(page.locator('.shell > .sidebar')).toBeVisible();
  await expect(lensOn(page, '.sidebar')).toHaveText(/^Marks/u);
});

// Tools that follow: the list stepped aside for the split stays aside, the tree listing the notes
// meanwhile; the marks are on the book's SHELF row.
test('the list stepped aside for a split stays aside: Marks shows the marks on SHELF', async ({
  page,
}) => {
  await onTablet(page, { 'layout.panes': 'three', 'appearance.split': 'follow' });
  await titles(page).first().click();
  await shelfBook(page).click({ button: 'right' });
  await page.locator('.menu [role^="menuitem"]', { hasText: 'Open to the Side' }).click();
  await expect(page.locator('.epub-chapter')).toContainText('It is a truth universally');
  await expect(page.locator('.shell > .list')).toBeHidden();
  await marksTool(page).click();
  await expect(lensOn(page, '.sidebar')).toHaveText(/^Marks/u);
  await expect(page.locator('.shell > .list')).toBeHidden();
});

// A companion: the layout's tools act on the page itself, the book, whichever page you're in;
// Marks shows its marks with the note beside it the one you're in.
test('with a note as the book’s companion, Marks shows the book’s marks, the note in front', async ({
  page,
}) => {
  await onTablet(page, { 'layout.panes': 'three', 'appearance.split': 'companion' });
  await shelfBook(page).locator('.tree-row__name').click();
  await expect(page.locator('.epub-chapter')).toContainText('It is a truth universally');
  await page.locator('.sidebar').getByText('All Notes', { exact: true }).click();
  await titles(page).first().click({ button: 'right' });
  await page.locator('.menu [role^="menuitem"]', { hasText: 'Open to the Side' }).click();
  await page.locator('.page .cm-content').click(); // the note, the page you're in
  await expect(lensOn(page, '.list')).toHaveCount(0); // the list's notes, no book's lenses
  await marksTool(page).click();
  await expect(lensOn(page, '.list')).toHaveText(/^Marks/u);
});
