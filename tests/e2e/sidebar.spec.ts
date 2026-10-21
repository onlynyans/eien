// The sidebar as the approved mockup has it (backlog #3, #5, #6, #9; spec
// §4): LIBRARY, FOLDERS and TAGS fold from their labels, remembered on this
// device across a restart, never leaving the keyboard on a row they hide; a
// hairline guide down each open branch, from its twisty's centre; BOOK beside
// a folder that's a book; and the foot's count says "1 note" for one.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { clickMenu, closeApp, expect, launchApp, test } from './launch';

const exactly = (text: string) => new RegExp(`^${text}$`);
const label = (page: Page, name: string) =>
  page.locator('.section__label').filter({ hasText: exactly(name) });
const folder = (page: Page, name: string) =>
  page
    .locator('.tree-row:not(.tree-row--note) .tree-row__name')
    .filter({ has: page.locator('.tree-row__label', { hasText: exactly(name) }) });
const treeNote = (page: Page, title: string) =>
  page
    .locator('.tree-row--note .tree-row__name')
    .filter({ has: page.locator('.tree-row__label', { hasText: exactly(title) }) });
/** The keyboard's control, if it's in sight: null for one hidden, gone, or for nothing. */
const focusedShown = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) return null;
    return active.checkVisibility() ? (active.textContent ?? '') : null;
  });
/** A pseudo-element's computed style. */
const pseudo = (locator: Locator, which: '::before', prop: string) =>
  locator.evaluate(
    (element, [which, prop]) => getComputedStyle(element, which).getPropertyValue(prop),
    [which, prop] as const,
  );
const twistyOpacity = (locator: Locator) =>
  locator.locator('.twisty').evaluate((twisty) => getComputedStyle(twisty).opacity);
/** A colour token as the window paints it. */
const tokenColour = (page: Page, name: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('i');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, name);

test.describe('sections, guides and books', () => {
  test.use({
    vaultFiles: {
      'Fic/Scarf/The Tear.md': 'The scarf catches. #winter\n',
      'Fic/Scarf/Needle.md': 'A sewing kit.\n',
      'Fic/Scarf/.eien-folder.json': JSON.stringify({
        order: ['The Tear.md', 'Needle.md'],
        book: {},
      }),
      'Research/Wool.md': 'Knitted wool runs. #winter\n',
    },
  });

  test('a section folds by its label, with the pointer, Enter or Space; its twisty turns', async ({
    page,
  }) => {
    const folders = label(page, 'Folders');
    await expect(folders).toHaveAttribute('aria-expanded', 'true');
    await expect(folder(page, 'Research')).toBeVisible();
    // Open, its twisty waits out of sight until the pointer or the keyboard comes.
    await page.mouse.move(1, 1);
    await expect.poll(() => twistyOpacity(folders)).toBe('0');
    // The pointer comes to rest on the label. Chromium sometimes misses a hover that arrives in one
    // move (1 in 5 on main, more on Linux's runner): it moves again until the label is under it.
    const box = await folders.boundingBox();
    if (!box) throw new Error('Folders has no box');
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    await expect(async () => {
      await page.mouse.move(x, y + 2);
      await page.mouse.move(x, y, { steps: 3 });
      expect(await twistyOpacity(folders)).toBe('1');
    }).toPass({ timeout: 5000 });

    await folders.click();
    await expect(folders).toHaveAttribute('aria-expanded', 'false');
    await expect(folder(page, 'Fic')).toBeHidden();
    await expect(folder(page, 'Research')).toBeHidden();
    await expect(label(page, 'Tags')).toHaveAttribute('aria-expanded', 'true');
    // Folded, the twisty stays in sight, pointing at the label (turned back, not swapped).
    await page.mouse.move(1, 1);
    await expect.poll(() => twistyOpacity(folders)).toBe('1');
    await expect
      .poll(() => pseudo(folders.locator('.twisty'), '::before', 'transform'))
      .toBe('none');

    await folders.focus();
    await page.keyboard.press('Enter');
    await expect(folders).toHaveAttribute('aria-expanded', 'true');
    await expect(folder(page, 'Research')).toBeVisible();
    // Open, it's turned a quarter: a rotation of 90°.
    await expect
      .poll(() => pseudo(folders.locator('.twisty'), '::before', 'transform'))
      .toMatch(/^matrix\([-0-9.e]+, 1, -1, [-0-9.e]+, 0, 0\)$/);
    await page.keyboard.press(' ');
    await expect(folders).toHaveAttribute('aria-expanded', 'false');
    await expect(folders).toBeFocused();

    await label(page, 'Library').click();
    await label(page, 'Tags').click();
    for (const row of await page.locator('.tree-row').all()) await expect(row).toBeHidden();
  });

  test('a fold never leaves the keyboard on a row it hides; Tab and ⌘1 pass over them', async ({
    app,
    page,
  }) => {
    const research = folder(page, 'Research');
    await research.focus();
    // A click that doesn't move the keyboard (a screen reader's): the label takes it.
    await label(page, 'Folders').dispatchEvent('click');
    await expect(label(page, 'Folders')).toHaveAttribute('aria-expanded', 'false');
    await expect(label(page, 'Folders')).toBeFocused();

    // Tab from Library's label: never a hidden row on the way to Tags'.
    await label(page, 'Library').focus();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await focusedShown(page)).not.toBeNull();
      if (await label(page, 'Tags').evaluate((el) => el === document.activeElement)) break;
    }
    await expect(label(page, 'Tags')).toBeFocused();

    // All Notes is the marked row; folded away, ⌘1 gives the keyboard to something in sight.
    await label(page, 'Library').click();
    await clickMenu(app, 'View', 'Go to Page');
    await clickMenu(app, 'View', 'Go to Sidebar');
    await expect.poll(() => focusedShown(page)).toMatch(/\S/);
    await expect(page.locator('.sidebar :focus')).toHaveCount(1);
  });

  test('which sections are folded is remembered on this device, across a restart', async ({
    app,
    page,
    userData,
    vault,
  }) => {
    await label(page, 'Tags').click();
    await expect(label(page, 'Tags')).toHaveAttribute('aria-expanded', 'false');
    await closeApp(app);
    const again = await launchApp(userData, vault);
    try {
      const page2 = await again.firstWindow();
      await expect(label(page2, 'Folders')).toHaveAttribute('aria-expanded', 'true');
      await expect(label(page2, 'Tags')).toHaveAttribute('aria-expanded', 'false');
      await expect(label(page2, 'Library')).toHaveAttribute('aria-expanded', 'true');
      await expect(folder(page2, 'Research')).toBeVisible();
      await expect(page2.locator('.tree-row__hash')).toHaveCount(1);
      await expect(page2.locator('.tree-row__hash')).toBeHidden();
    } finally {
      await closeApp(again);
    }
  });

  test('an open folder has a hairline guide down its children, from its twisty’s centre', async ({
    page,
  }) => {
    await expect(page.locator('.tree-group')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open Fic' }).click();
    const group = page.locator('.tree-group');
    await expect(group).toHaveCount(1);
    await expect(group.locator('.tree-row__label')).toHaveText(['Scarf']);
    expect(await pseudo(group, '::before', 'background-color')).toBe(
      await tokenColour(page, '--eien-rule'),
    );
    expect(await pseudo(group, '::before', 'width')).toBe('1px');
    // From the twisty's centre, and down to the middle of the last row under it.
    const twist = page.getByRole('button', { name: 'Close Fic' });
    const [twistBox, groupBox] = [await twist.boundingBox(), await group.boundingBox()];
    if (!twistBox || !groupBox) throw new Error('not drawn');
    const left = Number.parseFloat(await pseudo(group, '::before', 'left'));
    expect(Math.abs(groupBox.x + left - (twistBox.x + twistBox.width / 2))).toBeLessThanOrEqual(1);
    const rowHeight = (await folder(page, 'Scarf').boundingBox())?.height ?? 0;
    expect(Number.parseFloat(await pseudo(group, '::before', 'bottom'))).toBeCloseTo(
      rowHeight / 2,
      0,
    );
  });

  test('a book is marked BOOK beside its count; a folder made a book is marked at once', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Open Fic' }).click();
    const scarf = folder(page, 'Scarf');
    const mark = scarf.locator('.book-mark');
    await expect(mark).toHaveText('Book');
    await expect(mark).toHaveCSS('text-transform', 'uppercase');
    expect(await mark.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(
      await tokenColour(page, '--eien-rule'),
    );
    // Close to the count: a space, not the row's gap of two.
    const markBox = await mark.boundingBox();
    const countBox = await scarf.locator('.count').boundingBox();
    if (!markBox || !countBox) throw new Error('not drawn');
    expect(countBox.x - (markBox.x + markBox.width)).toBeCloseTo(4, 0);
    await expect(folder(page, 'Fic').locator('.book-mark')).toHaveCount(0);
    await expect(folder(page, 'Research').locator('.book-mark')).toHaveCount(0);

    await folder(page, 'Research').click({ button: 'right' });
    await page.locator('.menu [role^="menuitem"]', { hasText: 'Make it a book' }).click();
    await expect(folder(page, 'Research').locator('.book-mark')).toHaveText('Book');
  });

  test('with two panes, sections fold and guides run down the notes listed in the tree', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Two panes', pressed: false }).click();
    await page.getByRole('button', { name: 'Open Fic' }).click();
    await page.getByRole('button', { name: 'Open Scarf' }).click();
    await expect(treeNote(page, 'The Tear')).toBeVisible();
    // Fic's guide, and Scarf's inside it, down the book's chapters.
    await expect(page.locator('.tree-group')).toHaveCount(2);
    await expect(page.locator('.tree-group .tree-group .tree-row__label')).toHaveText([
      'The Tear',
      'Needle',
    ]);
    await expect(folder(page, 'Scarf').locator('.book-mark')).toHaveText('Book');

    await label(page, 'Folders').click();
    await expect(treeNote(page, 'The Tear')).toBeHidden();
    await label(page, 'Folders').click();
    await expect(treeNote(page, 'The Tear')).toBeVisible();
  });
});

test.describe('the foot’s count', () => {
  test.use({ vaultFiles: { 'Only.md': 'One note, alone.\n' } });

  test('says "1 note" for one, and "2 notes" once there are two', async ({ page, vault }) => {
    await expect(page.locator('.sidebar__count')).toHaveText('1 note');
    writeFileSync(join(vault ?? '', 'Second.md'), 'Another.\n');
    await expect(page.locator('.sidebar__count')).toHaveText('2 notes');
  });
});
