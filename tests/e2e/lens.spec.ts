// Backlog #12 (the lens) and #33 on the real app: a sort or a tag filter
// laid over a list, each a chip with its ×, your order kept underneath; the
// filter's three states; and, with two panes, the chosen row's lens in the
// sidebar acting on the tree's notes.

import type { Page } from '@playwright/test';
import { closeApp, expect, launchApp, test } from './launch';

test.use({
  vaultFiles: {
    'Fic/Thaw.md': 'The ice goes. #posted\n',
    'Fic/Needle.md': 'A sewing kit. #draft\n',
    'Fic/Gate.md': 'The gate holds. #posted #draft\n',
    'Fic/Fire.md': 'Mended by the fire. #fic/aot\n',
    'Fic/.eien-folder.json': JSON.stringify({
      order: ['Thaw.md', 'Needle.md', 'Gate.md', 'Fire.md'],
    }),
  },
});

const folder = (page: Page, name: string) =>
  page
    .locator('.tree-row__name')
    .filter({ has: page.locator('.tree-row__label', { hasText: new RegExp(`^${name}$`) }) });
const titles = (page: Page) => page.locator('.list .note-row__title');
const filterButton = (page: Page) => page.locator('.list [data-key="lens-filter:list"]');
const tri = (page: Page, tag: string) => page.locator(`.tag-filter .tri[data-tri="${tag}"]`);
const chips = (page: Page) => page.locator('.list .list__lens .chip');

async function openFic(page: Page): Promise<void> {
  await folder(page, 'Fic').click();
  await expect(titles(page)).toHaveText(['Thaw', 'Needle', 'Gate', 'Fire']);
}

test('a sort is a chip over your order; while it’s on, rows don’t move, and × brings your order back', async ({
  page,
}) => {
  await openFic(page);
  await page.locator('.list').hover();
  await page.locator('.list [data-key="lens-sort:list"]').click();
  await page.getByRole('menuitemradio', { name: 'Title' }).click();
  await expect(titles(page)).toHaveText(['Fire', 'Gate', 'Needle', 'Thaw']);
  await expect(chips(page)).toHaveText(['Title']);
  await expect(page.locator('.list__locked')).toHaveText(
    /Clear your sort or filters above to restore your order\./,
  );
  // Alt+↓ moves a row only in your order.
  await page.locator('.note-row', { hasText: 'Fire' }).focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(titles(page)).toHaveText(['Fire', 'Gate', 'Needle', 'Thaw']);
  await chips(page).getByRole('button', { name: 'Back to order' }).click();
  await expect(titles(page)).toHaveText(['Thaw', 'Needle', 'Gate', 'Fire']);
  await expect(chips(page)).toHaveCount(0);
  await expect(page.locator('.list__locked')).toHaveCount(0);
});

test('the tag filter: wanted, kept out, all of or any of, and Every note', async ({ page }) => {
  await openFic(page);
  await filterButton(page).click();
  await expect(page.getByRole('dialog', { name: 'Filter by tag' })).toBeVisible();
  await expect(tri(page, 'posted')).toHaveAttribute('aria-label', '#posted: left alone');
  await tri(page, 'posted').click();
  await expect(tri(page, 'posted')).toHaveAttribute('data-state', 'in');
  await expect(titles(page)).toHaveText(['Thaw', 'Gate']); // in your order still
  await expect(page.locator('.list__count')).toHaveText('2 of 4 notes');
  // ⌥ and a press keeps a tag out at once: the posted drafts go.
  await tri(page, 'draft').click({ modifiers: ['Alt'] });
  await expect(tri(page, 'draft')).toHaveAttribute('data-state', 'out');
  await expect(titles(page)).toHaveText(['Thaw']);
  await expect(chips(page)).toHaveText(['#posted', '#draft']);
  await expect(chips(page).nth(1)).toHaveClass(/is-out/);
  // A tag counts with the tags under it: wanting #fic finds #fic/aot.
  await tri(page, 'draft').click(); // left alone again
  await tri(page, 'fic').click();
  await expect(titles(page)).toHaveText([]); // all of: posted and fic
  await page.getByRole('button', { name: 'Any of' }).click();
  await expect(titles(page)).toHaveText(['Thaw', 'Gate', 'Fire']);
  await expect(page.locator('.list__match')).toHaveText('any of');
  await page.getByRole('button', { name: 'Every note' }).click();
  await expect(titles(page)).toHaveText(['Thaw', 'Needle', 'Gate', 'Fire']);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Filter by tag' })).toHaveCount(0);
  await expect(filterButton(page)).toBeFocused();
});

test('the filter is kept per list on this device, after a restart; a chip’s × leaves its tag alone', async ({
  app,
  page,
  userData,
  vault,
}) => {
  await openFic(page);
  await filterButton(page).click();
  await tri(page, 'draft').click();
  await page.keyboard.press('Escape');
  await expect(titles(page)).toHaveText(['Needle', 'Gate']);
  await closeApp(app);
  const again = await launchApp(userData, vault);
  try {
    const page2 = await again.firstWindow();
    await folder(page2, 'Fic').click();
    await expect(titles(page2)).toHaveText(['Needle', 'Gate']);
    await chips(page2).getByRole('button', { name: 'Leave #draft alone' }).click();
    await expect(titles(page2)).toHaveText(['Thaw', 'Needle', 'Gate', 'Fire']);
    // All Notes has its own lens: nothing laid over it.
    await page2.locator('.tree-row__name[data-key="all"]').click();
    await expect(page2.locator('.list .note-row')).toHaveCount(4);
  } finally {
    await closeApp(again);
  }
});

test('the filter’s panel works from the keyboard: arrows, Enter, ⌥Enter, Esc', async ({ page }) => {
  await openFic(page);
  await filterButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(tri(page, 'draft')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(tri(page, 'draft')).toHaveAttribute('data-state', 'in');
  await expect(tri(page, 'draft')).toBeFocused(); // the press redrew the panel; the keyboard stays
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Alt+Enter');
  await expect(page.locator('.tag-filter .tri[data-state="out"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(filterButton(page)).toBeFocused();
});

test('with two panes, the chosen row’s lens is on the search field’s row, and acts on the tree’s notes', async ({
  page,
}) => {
  await page.locator('.sidebar__foot [data-command="panes"][aria-pressed="false"]').click();
  await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
  await folder(page, 'Fic').click();
  // No list head in the sidebar: the search field, and the chosen row's sort and filter beside it.
  const find = page.locator('.sidebar__find');
  await expect(find.getByRole('searchbox')).toBeVisible();
  const tools = find.getByRole('group', { name: 'Sort and filter Fic' });
  await expect(tools.locator('[data-key="lens-filter:tree"]')).toHaveCount(1);
  await expect(page.locator('.sidebar :is(.list__head, .list__heading, .list__meta)')).toHaveCount(
    0,
  );
  await expect(page.locator('.sidebar__lens')).toBeHidden(); // no chips while no lens is on
  const notes = page.locator('.tree-row--note .tree-row__label');
  await expect(notes).toHaveText(['Thaw', 'Needle', 'Gate', 'Fire']);
  await tools.locator('[data-key="lens-filter:tree"]').click();
  await tri(page, 'posted').click();
  await page.keyboard.press('Escape');
  await expect(notes).toHaveText(['Thaw', 'Gate']);
  const chips = page.locator('.sidebar__lens .chip');
  await expect(chips).toHaveText(['#posted']);
  await chips.getByRole('button').click();
  await expect(notes).toHaveText(['Thaw', 'Needle', 'Gate', 'Fire']);
});

test('the sidebar’s TAGS: ⇧ and a click wants a tag in the list’s filter, ⌥ keeps it out (#32)', async ({
  page,
}) => {
  await openFic(page);
  const tagRow = (tag: string) => page.locator(`.tree-row__name[data-key="tag:${tag}"]`);
  await tagRow('posted').click({ modifiers: ['Shift'] });
  await expect(titles(page)).toHaveText(['Thaw', 'Gate']);
  await expect(page.locator('.list__heading')).toHaveText('Fic'); // still the folder's list
  await expect(tagRow('posted')).toHaveAttribute('data-filter', 'in');
  await expect(tagRow('posted').locator('.tree-row__filter')).toHaveAttribute(
    'aria-label',
    'wanted',
  );
  await tagRow('draft').click({ modifiers: ['Alt'] });
  await expect(titles(page)).toHaveText(['Thaw']);
  await expect(tagRow('draft')).toHaveAttribute('data-filter', 'out');
  await expect(chips(page)).toHaveText(['#posted', '#draft']);
  // From the keyboard: ⌥Enter keeps out, again, leaves it alone.
  await tagRow('draft').focus();
  await page.keyboard.press('Alt+Enter');
  await expect(tagRow('draft')).not.toHaveAttribute('data-filter', /./);
  await expect(titles(page)).toHaveText(['Thaw', 'Gate']);
  // A plain click still chooses the tag.
  await tagRow('draft').click();
  await expect(page.locator('.list__heading')).toHaveText('#draft');
});
