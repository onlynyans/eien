// The search field on the real app (spec §4, backlog #11): with three panes,
// on its own band at the top of the list, searching only the notes that list
// holds; with two panes, or the list shut, under the vault's name in the
// sidebar, searching the whole vault. ⇧⌘F gives the keyboard to whichever
// is showing.

import type { Page } from '@playwright/test';
import { boxOf, clickMenu, expect, test } from './launch';

test.use({
  vaultFiles: {
    'Fic/Mended.md': 'The scarf, mended.\n',
    'Fic/Scarf/The Tear.md': 'The scarf catches. #winter\n',
    'Ideas.md': 'A scarf for the snow. #winter\n',
    'Research/Wool.md': 'Knitted wool, for a scarf.\n',
    'Plain.md': 'Nothing to find here.\n',
    '.eien/pinned.json': '["Research/Wool.md"]\n',
  },
});

const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const field = (page: Page) => page.getByRole('searchbox');
const listField = (page: Page) => page.locator('.list__search').getByRole('searchbox');
const sidebarField = (page: Page) => page.locator('.sidebar__search').getByRole('searchbox');
const titles = (page: Page) => page.locator('.note-row__title');
const treeNotes = (page: Page) => page.locator('.tree-row--note .tree-row__label');
const heading = (page: Page) => page.locator('.list__heading');
const count = (page: Page) => page.locator('.list__count');
const choose = (page: Page, label: string) =>
  page
    .locator('.tree-row__label', { hasText: exactly(label) })
    .first()
    .click();
/** Whether the keyboard is somewhere in `selector`. */
const focusIn = (page: Page, selector: string) =>
  page.evaluate(
    (selector) => !!document.querySelector(selector)?.contains(document.activeElement),
    selector,
  );
const vaultName = async (page: Page) => (await page.locator('.sidebar__vault').textContent()) ?? '';

/** The vault shown, with All Notes listed. */
async function ready(page: Page): Promise<void> {
  await expect(titles(page)).toHaveCount(5);
}

test.describe('three panes: the field on the list’s band', () => {
  test('sits above the list’s heading, a band tall, and says what it searches', async ({
    page,
  }) => {
    await ready(page);
    await expect(field(page)).toHaveCount(1);
    await expect(listField(page)).toBeVisible();
    await expect(page.locator('.sidebar__search')).toBeHidden();
    await expect(listField(page)).toHaveAttribute('placeholder', 'Search All Notes');
    const band = await boxOf(page.locator('.list__search'));
    const top = await boxOf(page.locator('.list__head'));
    const strip = await boxOf(page.locator('.page__bar'));
    expect(band.height).toBe(strip.height); // the panes' tops line up
    expect(band.y + band.height).toBeLessThanOrEqual(top.y);
    expect(band.y).toBe((await boxOf(page.locator('.list'))).y);
    // 1A's bands drag the window: the field never does, or it couldn't be clicked.
    const region = await page
      .locator('.list__search .search')
      .evaluate((element) => getComputedStyle(element).getPropertyValue('-webkit-app-region'));
    expect(region).toBe('no-drag');

    await choose(page, 'Fic');
    await expect(listField(page)).toHaveAttribute('placeholder', 'Search Fic');
    await expect(listField(page)).toHaveAttribute('aria-label', 'Search Fic');
    await choose(page, '#winter');
    await expect(listField(page)).toHaveAttribute('placeholder', 'Search #winter');
  });

  test('a folder’s search finds only the notes its list holds; Esc and emptying give it back', async ({
    page,
  }) => {
    await ready(page);
    await choose(page, 'Fic');
    await expect(titles(page)).toHaveText(['Mended']);
    await listField(page).fill('scarf');
    // Not The Tear, in Fic/Scarf, nor Ideas: they aren't in Fic's list.
    await expect(heading(page)).toHaveText('“scarf”');
    await expect(titles(page)).toHaveText(['Mended']);
    await expect(count(page)).toHaveText('1 note matches · Fic');
    await listField(page).press('Escape');
    await expect(listField(page)).toHaveValue('');
    await expect(heading(page)).toHaveText('Fic');

    await listField(page).fill('snow');
    await expect(count(page)).toHaveText('No notes match · Fic');
    await expect(page.locator('.list__empty')).toContainText('No notes match.');
    await listField(page).fill('');
    await expect(heading(page)).toHaveText('Fic');
    await expect(titles(page)).toHaveText(['Mended']);
  });

  test('a tag’s, Pinned’s and All Notes’ searches each keep to their own notes', async ({
    page,
  }) => {
    await ready(page);
    await choose(page, '#winter');
    await listField(page).fill('scarf');
    await expect(count(page)).toHaveText('2 notes match · #winter');
    expect((await titles(page).allTextContents()).sort()).toEqual(['Ideas', 'The Tear']);

    await choose(page, 'Pinned');
    await expect(listField(page)).toHaveValue(''); // choosing a list ends the search
    await listField(page).fill('scarf');
    await expect(titles(page)).toHaveText(['Wool']);

    await choose(page, 'All Notes');
    await listField(page).fill('scarf');
    await expect(titles(page)).toHaveCount(4);
    await expect(count(page)).toHaveText('4 notes match · All Notes');
  });
});

test.describe('no list in sight: the field in the sidebar, searching the whole vault', () => {
  test('with two panes', async ({ page }) => {
    await ready(page);
    await choose(page, 'Fic');
    await page.getByRole('button', { name: '2 panes' }).click();
    await expect(field(page)).toHaveCount(1);
    await expect(sidebarField(page)).toBeVisible();
    await expect(sidebarField(page)).toHaveAttribute(
      'placeholder',
      `Search ${await vaultName(page)}`,
    );
    await sidebarField(page).fill('scarf');
    await expect(page.locator('.sidebar__label')).toHaveText(['Results']);
    await expect(treeNotes(page)).toHaveCount(4);

    // Back to three: the same words, now searching Fic's list, from the list's band.
    await page.getByRole('button', { name: '3 panes' }).click();
    await expect(listField(page)).toHaveValue('scarf');
    await expect(titles(page)).toHaveText(['Mended']);
  });

  test('with the list shut, and again in the list once it’s opened', async ({ app, page }) => {
    await ready(page);
    await choose(page, 'Research');
    await listField(page).fill('snow');
    await expect(count(page)).toHaveText('No notes match · Research');
    // Shut with the keyboard in it, the list gives the keyboard to the page (spec §4); the field
    // moves to the sidebar with its words.
    await clickMenu(app, 'View', 'Toggle Note List');
    await expect.poll(() => focusIn(page, '.page')).toBe(true);
    await expect(sidebarField(page)).toHaveValue('snow');
    await expect(treeNotes(page)).toHaveText(['Ideas']); // the whole vault's
    await clickMenu(app, 'View', 'Toggle Note List');
    await expect(listField(page)).toHaveValue('snow');
    await expect(count(page)).toHaveText('No notes match · Research');
    await expect(page.locator('.sidebar__label')).not.toHaveText(['Results']);
  });
});

test.describe('⇧⌘F, Edit → Search Notes…', () => {
  test('gives the keyboard to the list’s field, even with the sidebar shut', async ({
    app,
    page,
  }) => {
    await ready(page);
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await expect(page.locator('.sidebar__show')).toBeVisible();
    await clickMenu(app, 'Edit', 'Search Notes…');
    await expect(listField(page)).toBeFocused();
    await expect(page.locator('.sidebar__show')).toBeVisible(); // the sidebar stays shut
  });

  test('with no list in sight, opens the sidebar and gives the keyboard to its field', async ({
    app,
    page,
  }) => {
    await ready(page);
    await clickMenu(app, 'View', 'Toggle Note List');
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await expect(page.locator('.sidebar__show')).toBeVisible();
    await clickMenu(app, 'Edit', 'Search Notes…');
    await expect(sidebarField(page)).toBeFocused();
  });
});
