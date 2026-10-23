// The split (spec §4, docs/split-and-windows.md phase 5): two notes side by
// side in one window, Two sheets. Opened from a row (Ctrl/⌘-click, its menu),
// View → Split Page (⌘D); closed with the sheet's × or Close Window (⌘W)
// while split; swapped; folded into one page when the pane is too narrow.
// Saves are waited for on the file itself (readQuietly), never on a time.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ALONE, boxOf, clickMenu, expect, readQuietly, test } from './launch';

const row = (page: Page, title: string) => page.locator('.note-row', { hasText: title });
const pages = (page: Page) => page.locator('.page__pages > .page__scroll');
const active = (page: Page) => page.locator('.page__pages > .page__scroll[data-active]');
const editorIn = (scroll: ReturnType<typeof pages>) => scroll.locator('.cm-content');

/** Open the note titled `title` on the page, and wait for its words. */
async function openNote(page: Page, title: string, words: string): Promise<void> {
  await row(page, title).click();
  await expect(editorIn(active(page))).toContainText(words);
}

test.describe('the split', () => {
  test.use({
    vaultFiles: {
      'Chapter.md': 'The gate held.\n',
      'Notes.md': 'Snow on the walls.\n',
    },
  });

  test('opens a note beside the page with Ctrl/⌘-click, the list marking both', async ({
    page,
  }) => {
    await openNote(page, 'Chapter', 'The gate held.');
    await row(page, 'Notes').click({ modifiers: ['ControlOrMeta'] });
    await expect(pages(page)).toHaveCount(2);
    await expect(editorIn(active(page))).toContainText('Snow on the walls.');
    await expect(page.locator('.page__pages > .divider')).toBeVisible();
    // The chosen row is the active page's note; the other page's keeps a fainter mark.
    await expect(row(page, 'Notes')).toHaveAttribute('aria-current', 'true');
    await expect(row(page, 'Chapter')).toHaveAttribute('data-beside', '');
    await expect(page).toHaveTitle('Notes');
  });

  test('opens a note to the side from its menu', async ({ page }) => {
    await openNote(page, 'Chapter', 'The gate held.');
    await row(page, 'Notes').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Open to the Side' }).click();
    await expect(pages(page)).toHaveCount(2);
    await expect(editorIn(pages(page).nth(1))).toContainText('Snow on the walls.');
  });

  test('shows one note on both pages, typed on one, saved once, no conflict copy', async ({
    app,
    page,
    vault,
  }) => {
    if (!vault) throw new Error('no vault');
    await openNote(page, 'Chapter', 'The gate held.');
    await clickMenu(app, 'View', 'Split Page');
    await expect(pages(page)).toHaveCount(2);
    const [left, right] = [editorIn(pages(page).nth(0)), editorIn(pages(page).nth(1))];
    await right.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' Then rain.');
    await expect(left).toContainText('The gate held. Then rain.');
    await expect
      .poll(() => readQuietly(join(vault, 'Chapter.md')))
      .toBe('The gate held. Then rain.\n');
    expect(
      readdirSync(vault)
        .filter((name) => name.endsWith('.md'))
        .sort(),
    ).toEqual(['Chapter.md', 'Notes.md']);
  });

  test('closes the active page with Close Window, and the window with it after', async ({
    app,
    page,
  }) => {
    await openNote(page, 'Chapter', 'The gate held.');
    await row(page, 'Notes').click({ modifiers: ['ControlOrMeta'] });
    await expect(pages(page)).toHaveCount(2);
    await clickMenu(app, 'File', 'Close Window');
    await expect(pages(page)).toHaveCount(1);
    await expect(editorIn(active(page))).toContainText('The gate held.');
    expect(app.windows()).toHaveLength(1);
  });

  test('closes a page with its ×, and swaps the two', async ({ app, page }) => {
    await openNote(page, 'Chapter', 'The gate held.');
    await row(page, 'Notes').click({ modifiers: ['ControlOrMeta'] });
    await clickMenu(app, 'View', 'Swap Pages');
    await expect(editorIn(pages(page).nth(0))).toContainText('Snow on the walls.');
    await expect(editorIn(active(page))).toContainText('Snow on the walls.');
    await pages(page).nth(1).hover();
    await pages(page).nth(1).getByRole('button', { name: 'Close this page' }).click();
    await expect(pages(page)).toHaveCount(1);
    await expect(editorIn(active(page))).toContainText('Snow on the walls.');
  });

  test('folds the two pages into one when the pane is too narrow, a pager naming both', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await openNote(page, 'Chapter', 'The gate held.');
    await row(page, 'Notes').click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('.page__pages[data-folded]')).toHaveCount(0);
    await page.setViewportSize({ width: 1000, height: 800 }); // the page well under two 360 px pages
    await expect(page.locator('.page__pages[data-folded]')).toHaveCount(1);
    await expect(pages(page).filter({ visible: true })).toHaveCount(1);
    const pager = page.getByRole('group', { name: 'The two pages' });
    await expect(pager.getByRole('button')).toHaveText(['Chapter', 'Notes']);
    await pager.getByRole('button', { name: 'Chapter' }).click();
    await expect(editorIn(active(page))).toContainText('The gate held.');
    await page.setViewportSize({ width: 1400, height: 800 });
    await expect(page.locator('.page__pages[data-folded]')).toHaveCount(0);
  });

  test('moves the divider by a drag, and evens it with a double-click', ALONE, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openNote(page, 'Chapter', 'The gate held.');
    await row(page, 'Notes').click({ modifiers: ['ControlOrMeta'] });
    const divider = page.getByRole('separator', { name: 'Between the two pages' });
    await expect(divider).toHaveAttribute('aria-valuenow', '50');
    const at = await boxOf(divider);
    await page.mouse.move(at.x + at.width / 2, at.y + 40);
    await page.mouse.down();
    await page.mouse.move(at.x + at.width / 2 + 120, at.y + 40, { steps: 4 });
    await page.mouse.up();
    const left = await boxOf(pages(page).nth(0));
    const right = await boxOf(pages(page).nth(1));
    expect(left.width).toBeGreaterThan(right.width + 200);
    await divider.dblclick({ position: { x: 0, y: 40 } });
    await expect(divider).toHaveAttribute('aria-valuenow', '50');
  });
});
