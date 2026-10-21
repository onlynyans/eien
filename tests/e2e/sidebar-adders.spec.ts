// Backlog #4 and #7 on the real app: the quiet + beside FOLDERS and TAGS, a
// tag made before any note carries it (kept in .eien/tags.json), and Pinned
// always in sight, saying how to pin when nothing is.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './launch';

test.use({
  vaultFiles: {
    'Ideas.md': 'Snow on the walls. #draft\n',
    'Thaw.md': 'The ice goes.\n',
  },
});

const at = (vault: string | null, path: string) => join(vault ?? '', ...path.split('/'));
const madeTags = (vault: string | null): string[] => {
  try {
    return (JSON.parse(readFileSync(at(vault, '.eien/tags.json'), 'utf8')) as { made: string[] })
      .made;
  } catch {
    return [];
  }
};
const tagRow = (page: Page, name: string) =>
  page
    .locator('.tree-row__name')
    .filter({ has: page.locator('.tree-row__label', { hasText: new RegExp(`^#${name}$`) }) });
const newTag = (page: Page) => page.getByRole('button', { name: 'New tag' });
const tagField = (page: Page) => page.getByRole('textbox', { name: 'New tag' });

test('the + beside TAGS names a tag in place; it has no notes yet, and says how to give it some', async ({
  page,
  vault,
}) => {
  await newTag(page).click();
  await expect(tagField(page)).toBeFocused();
  await page.keyboard.type('#ideas');
  await page.keyboard.press('Enter');
  await expect.poll(() => madeTags(vault)).toEqual(['ideas']);
  const row = tagRow(page, 'ideas');
  await expect(row).toBeFocused();
  await expect(row.locator('.count')).toHaveText('0');
  await expect(row.locator('xpath=..')).toHaveClass(/tree-row--empty/);
  await expect(page.locator('.tree-hint', { hasText: 'No notes yet' })).toBeVisible();
  // Chosen, its list says how to fill it.
  await row.click();
  await expect(page.locator('.list__empty')).toHaveText(/No notes carry this tag yet/);
  // A note given the tag: it counts, and isn't faded.
  writeFileSync(at(vault, 'Thaw.md'), 'The ice goes. #ideas\n');
  await expect(row.locator('.count')).toHaveText('1');
  await expect(row.locator('xpath=..')).not.toHaveClass(/tree-row--empty/);
});

test('a name that can’t be a tag, or one there already, says so; Esc makes nothing', async ({
  page,
  vault,
}) => {
  await newTag(page).click();
  await page.keyboard.type('two words');
  await expect(page.locator('.tree-hint--problem')).toHaveText(/letters and numbers/);
  await page.keyboard.press('Enter');
  await expect(tagField(page)).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('DRAFT');
  await expect(page.locator('.tree-hint--problem')).toHaveText('#DRAFT is there already.');
  await page.keyboard.press('Escape');
  await expect(tagField(page)).toHaveCount(0);
  await expect(newTag(page)).toBeFocused();
  await page.waitForTimeout(300);
  expect(madeTags(vault)).toEqual([]);
});

test('a tag made, and no note carrying it, is taken back out from its menu', async ({
  page,
  vault,
}) => {
  await newTag(page).click();
  await page.keyboard.type('later');
  await page.keyboard.press('Enter');
  await expect(tagRow(page, 'later')).toBeVisible();
  await tagRow(page, 'later').click({ button: 'right' });
  const menu = page.getByRole('menu', { name: '#later' });
  await menu.getByRole('menuitem', { name: 'Remove this tag' }).click();
  await expect(tagRow(page, 'later')).toHaveCount(0);
  expect(madeTags(vault)).toEqual([]);
  // A tag notes carry has no menu: renaming one everywhere isn't designed yet.
  await tagRow(page, 'draft').click({ button: 'right' });
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('a tag another device made shows here, as the file changes', async ({ page, vault }) => {
  mkdirSync(at(vault, '.eien'), { recursive: true });
  writeFileSync(at(vault, '.eien/tags.json'), JSON.stringify({ made: ['from-phone'] }));
  await expect(tagRow(page, 'from-phone')).toBeVisible();
});

test('the + beside FOLDERS names a folder in place, as New folder did', async ({ page }) => {
  await page.getByRole('button', { name: 'New folder' }).click();
  await expect(page.locator('.tree-row__field')).toBeFocused();
  await page.keyboard.press('Escape');
});

test('each + has its tooltip, at once when the keyboard reaches it', async ({ page }) => {
  await page.keyboard.press('Shift'); // a key first: the focus that follows is the keyboard's
  await newTag(page).focus();
  await expect(page.locator('.tooltip')).toBeVisible();
  await expect(page.locator('.tooltip__words')).toHaveText('New tag');
  await page.getByRole('button', { name: 'New folder' }).focus();
  await expect(page.locator('.tooltip__words')).toHaveText('New folder');
});

test('Pinned is always under Library: with nothing pinned, its list says how to pin', async ({
  page,
}) => {
  const pinned = page.locator('.tree-row__name[data-key="pinned"]');
  await expect(pinned).toBeVisible();
  await expect(pinned.locator('.count')).toHaveText('0');
  await expect(pinned.locator('svg.icon')).toHaveCount(1);
  await pinned.click();
  await expect(page.locator('.list__empty')).toHaveText(/Nothing pinned yet/);
});

test('every quiet icon shows by one rule: the row it sits in hovered, in the list as in the sidebar', async ({
  page,
}) => {
  const opacity = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((control) => getComputedStyle(control).opacity);
  const rest = async () => {
    await page.mouse.move(1, 1);
    await expect.poll(() => opacity('.list__head .add-button')).toBe('0');
    await expect.poll(() => opacity('.sidebar__section .add-button')).toBe('0');
  };
  /** Hover `row` until its quiet icons have come in (a hover can miss its first move). */
  const hover = async (row: string) => {
    const box = await page.locator(row).first().boundingBox();
    if (!box) throw new Error(`${row} has no box`);
    await expect(async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + 4);
      await page.mouse.move(box.x + box.width / 2 + 2, box.y + 6);
      expect(await opacity(`${row} .icon-button--quiet`)).toBe('1');
    }).toPass({ timeout: 5000 });
  };
  await rest();
  // The list's head: the + (New note) and the lens's icons come in together; the sidebar's stay out.
  await hover('.list__head');
  expect(await opacity('.list__head [data-key="lens-filter:list"]')).toBe('1');
  expect(await opacity('.sidebar__section .add-button')).toBe('0');
  // A sidebar section: its + comes in; the list's stay out.
  await rest();
  await hover('.sidebar__section:has([data-key="new-folder"])');
  expect(await opacity('.list__head .add-button')).toBe('0');
  // The list's + is New note, with its key in the tooltip, from the keyboard too.
  await page.keyboard.press('Shift');
  await page.getByRole('button', { name: 'New note' }).focus();
  await expect(page.locator('.tooltip__words')).toHaveText('New note');
  await expect(page.locator('.tooltip__key')).not.toBeEmpty();
});
