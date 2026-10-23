// Tools that follow (spec §4, Split; docs/split-and-windows.md phase 8): the
// note list steps aside for two pages, and comes back; the pane's furniture
// stands over the page you're in, the keyboard kept as it moves; a split
// without the room is refused, and says why.

import type { Page } from '@playwright/test';
import { boxOf, expect, test } from './launch';

const row = (page: Page, title: string) => page.locator('.note-row', { hasText: title });
const leaves = (page: Page) => page.locator('.page__pages > .page__leaf');

test.describe('tools that follow', () => {
  test.use({
    vaultFiles: { 'Chapter.md': 'The gate held.\n', 'Notes.md': 'Snow on the walls.\n' },
    deviceFile: { settings: { 'appearance.split': 'follow' } },
  });

  test('the list steps aside for two pages, and comes back with ⇧⌘\\', async ({ app, page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await row(page, 'Chapter').click();
    await row(page, 'Notes').click({ modifiers: ['ControlOrMeta'] });
    await expect(leaves(page)).toHaveCount(2);
    await expect(page.locator('.shell')).toHaveAttribute('data-list-shut', '');
    // The tree lists the notes meanwhile, as with two panes.
    await expect(page.locator('.tree-row--note').first()).toBeVisible();
    await app.evaluate(({ BrowserWindow, Menu }) => {
      const window = BrowserWindow.getAllWindows()[0];
      const item = Menu.getApplicationMenu()
        ?.items.find((each) => each.label === 'View')
        ?.submenu?.items.find((each) => each.label === 'Toggle Note List');
      item?.click(undefined, window, window?.webContents);
    });
    await expect(page.locator('.shell')).not.toHaveAttribute('data-list-shut', '');
    await expect(leaves(page)).toHaveCount(2);
  });

  test('the band, the formatting bar and the colophon stand over the page you’re in', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await row(page, 'Chapter').click();
    await row(page, 'Notes').click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('.page__main[data-follow-side="1"]')).toHaveCount(1);
    const colophon = page.locator('.colophon');
    const right = await boxOf(leaves(page).nth(1));
    expect(Math.round((await boxOf(colophon)).x)).toBe(Math.round(right.x));
    await leaves(page).nth(0).locator('.cm-content').click();
    await expect(page.locator('.page__main[data-follow-side="0"]')).toHaveCount(1);
    const left = await boxOf(leaves(page).nth(0));
    await expect.poll(async () => Math.round((await boxOf(colophon)).x)).toBe(Math.round(left.x));
    // The keyboard stayed in the words it went to: nothing was moved out from under it.
    await expect(leaves(page).nth(0).locator('.cm-content')).toBeFocused();
  });

  test('refuses a split without the room, and says why', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await row(page, 'Chapter').click();
    await row(page, 'Notes').click({ modifiers: ['ControlOrMeta'] });
    await expect(page.getByText(/Too narrow for two pages beside the sidebar/)).toBeVisible();
    await expect(leaves(page)).toHaveCount(1);
  });

  test('narrowed while split, shows the page you’re in, the other waiting', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await row(page, 'Chapter').click();
    await row(page, 'Notes').click({ modifiers: ['ControlOrMeta'] });
    await expect(leaves(page)).toHaveCount(2);
    await page.setViewportSize({ width: 960, height: 800 });
    await expect(page.locator('.page__pages[data-narrow="wait"]')).toHaveCount(1);
    await expect(page.locator('.colophon__waits')).toContainText('Chapter waits');
  });
});
