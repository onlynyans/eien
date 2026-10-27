// A pane shut and opened again comes back where it was (backlog #43): the
// same rows in sight, and the keyboard back on the row it left. The note list
// and the sidebar's tree, a short list and a long one drawn by the rows in
// sight, with three panes and two. Kept for the session only.

import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, expect, test, type VaultFiles } from './launch';

/** `count` notes at the vault's top, named so they sort as they're numbered. */
const notes = (count: number): VaultFiles =>
  Object.fromEntries(
    Array.from({ length: count }, (_, i) => [
      `Note ${String(i).padStart(3, '0')}.md`,
      `Words of note ${i}.\n`,
    ]),
  );
/** `count` folders, a note in each: a tree taller than the sidebar with three panes. */
const folders = (count: number): VaultFiles =>
  Object.fromEntries(
    Array.from({ length: count }, (_, i) => [
      `Folder ${String(i).padStart(2, '0')}/Inside.md`,
      'Words.\n',
    ]),
  );

const LIST = { scroller: '.list .rows', row: '.note-row', label: '.note-row__title' };
const TREE = { scroller: '.sidebar__tree', row: '.tree-row__name', label: '.tree-row__label' };
type Pane = typeof LIST;

/** The labels of the rows in sight in `pane`'s scroller, top to bottom. */
const inSight = (page: Page, pane: Pane) =>
  page.evaluate(({ scroller, label }) => {
    const box = document.querySelector(scroller)?.getBoundingClientRect();
    if (!box || box.height === 0) return [];
    return [...document.querySelectorAll<HTMLElement>(`${scroller} ${label}`)]
      .filter((element) => {
        const at = element.getBoundingClientRect();
        return at.height > 0 && at.bottom > box.top + 1 && at.top < box.bottom - 1;
      })
      .map((element) => element.textContent ?? '');
  }, pane);

/** The label of the row with the keyboard, if a row has it. */
const focusedLabel = (page: Page, pane: Pane) =>
  page.evaluate(
    ({ row, label }) =>
      document.activeElement?.closest(row)?.querySelector(label)?.textContent ?? null,
    pane,
  );

/**
 * Scroll `pane` most of the way down, past its first row, and give the
 * keyboard to a row in sight there: what it shows once it has settled.
 */
async function scrollDown(page: Page, pane: Pane): Promise<string[]> {
  await expect.poll(async () => (await inSight(page, pane)).length).toBeGreaterThan(3);
  const [first] = await inSight(page, pane);
  await page.locator(pane.scroller).evaluate((element) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) * 0.6;
  });
  await expect.poll(() => inSight(page, pane)).not.toContain(first);
  // A long list draws the rows in sight a frame after the scroll: wait for them to hold still.
  let last: string[] = [];
  await expect
    .poll(async () => {
      const now = await inSight(page, pane);
      const still = now.length > 3 && now.join() === last.join();
      last = now;
      return still;
    })
    .toBe(true);
  const middle = last[Math.floor(last.length / 2)] as string;
  await page.locator(pane.row).filter({ hasText: middle }).first().focus();
  expect(await focusedLabel(page, pane)).toBe(middle);
  // Focusing a row in sight doesn't scroll: the same rows are still there.
  expect(await inSight(page, pane)).toEqual(last);
  return last;
}

async function allNotes(page: Page): Promise<void> {
  await page.locator('.tree-row__name[data-key="all"]').click();
}

async function twoPanes(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Two panes', pressed: false }).click();
  await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
}

/**
 * Shut and open `which`; the same rows come back in sight, and Go to … finds
 * the row the keyboard left. Then shut it again and let Go to … open it.
 */
async function keepsItsPlace(
  app: ElectronApplication,
  page: Page,
  which: 'sidebar' | 'list',
  pane: Pane,
): Promise<void> {
  const [toggle, goTo, shut] =
    which === 'sidebar'
      ? (['Toggle Sidebar', 'Go to Sidebar', 'data-sidebar-shut'] as const)
      : (['Toggle Note List', 'Go to Note List', 'data-list-shut'] as const);
  const before = await scrollDown(page, pane);
  const left = await focusedLabel(page, pane);
  await clickMenu(app, 'View', toggle);
  await expect(page.locator('.shell')).toHaveAttribute(shut, '');
  await clickMenu(app, 'View', toggle);
  await expect(page.locator('.shell')).not.toHaveAttribute(shut, '');
  await expect.poll(() => inSight(page, pane)).toEqual(before);
  // The keyboard went to the page as the pane shut; going back finds the row it left.
  await clickMenu(app, 'View', goTo);
  await expect.poll(() => focusedLabel(page, pane)).toBe(left);
  await expect.poll(() => inSight(page, pane)).toEqual(before);

  await clickMenu(app, 'View', toggle);
  await expect(page.locator('.shell')).toHaveAttribute(shut, '');
  await clickMenu(app, 'View', goTo);
  await expect(page.locator('.shell')).not.toHaveAttribute(shut, '');
  await expect.poll(() => focusedLabel(page, pane)).toBe(left);
  await expect.poll(() => inSight(page, pane)).toEqual(before);
}

test.describe('a short note list', () => {
  test.use({ vaultFiles: notes(80) });

  test('shut and opened, it shows the rows it showed, the keyboard on its row', async ({
    app,
    page,
  }) => {
    await allNotes(page);
    await keepsItsPlace(app, page, 'list', LIST);
  });
});

test.describe('a long note list', () => {
  test.use({ vaultFiles: notes(400) });

  test('drawn by the rows in sight, it comes back where it was', async ({ app, page }) => {
    await allNotes(page);
    await expect(page.locator('.rows > li[aria-setsize="400"]').first()).toBeVisible();
    await keepsItsPlace(app, page, 'list', LIST);
  });
});

test.describe("the sidebar's tree, three panes", () => {
  test.use({ vaultFiles: folders(80) });

  test('shut and opened, it shows the folders it showed', async ({ app, page }) => {
    await keepsItsPlace(app, page, 'sidebar', TREE);
  });
});

test.describe("the sidebar's tree, two panes", () => {
  test.use({ vaultFiles: notes(400) });

  test('its long list of notes comes back where it was', async ({ app, page }) => {
    await twoPanes(page);
    await allNotes(page);
    await expect(page.locator('.tree-window li[aria-setsize="400"]').first()).toBeVisible();
    await keepsItsPlace(app, page, 'sidebar', TREE);
  });
});
