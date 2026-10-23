// New Window (spec §4, docs/split-and-windows.md phase 2): several windows,
// each with its own vault, note, panes and split, the vault's folder shared.
// Every check that crosses windows waits on the effect itself (a note's words
// on screen, a file's text through readQuietly), never on a time: the
// end-to-end runs on Windows are already slow to see a write land.

import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { clickMenuIn, editorContent, expect, newWindow, readQuietly, test } from './launch';

const row = (page: Page, title: string) => page.locator('.note-row', { hasText: title });
const status = (page: Page) => page.locator('.sidebar__foot .sync-status');

/** Open the note titled `title` in `page`, and wait for its words. */
async function openNote(page: Page, title: string, words: string): Promise<void> {
  await row(page, title).click();
  await expect(editorContent(page)).toContainText(words);
}

test.describe('New Window', () => {
  test.use({
    vaultFiles: {
      '.stfolder': '', // so the sync status shows, and can be seen to stay quiet
      'Ideas.md': 'Snow on the walls.\n',
      'Rations.md': 'Half a loaf.\n',
    },
  });

  test('opens a window on the same vault and note, named for it', async ({ app, page }) => {
    await openNote(page, 'Ideas', 'Snow on the walls.');
    await expect(page).toHaveTitle('Ideas');
    const second = await newWindow(app);
    await expect(second).toHaveTitle('Ideas');
    await expect(editorContent(second)).toContainText('Snow on the walls.');
    expect(app.windows()).toHaveLength(2);
  });

  test('a note’s menu opens it in a window of its own', async ({ app, page }) => {
    await expect(row(page, 'Rations')).toBeVisible();
    await row(page, 'Rations').click({ button: 'right' });
    const [second] = await Promise.all([
      app.waitForEvent('window'),
      page.getByRole('menuitem', { name: 'Open in New Window' }).click(),
    ]);
    await expect(second).toHaveTitle('Rations');
    await expect(editorContent(second)).toContainText('Half a loaf.');
  });

  test('a save in one window shows in the other, and the sync status stays quiet', async ({
    app,
    page,
    vault,
  }) => {
    await openNote(page, 'Ideas', 'Snow on the walls.');
    const second = await newWindow(app);
    await expect(editorContent(second)).toContainText('Snow on the walls.');
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' The gate held.');
    // The write itself, on disk; then the other window, which reloads from it.
    await expect.poll(() => readQuietly(join(vault ?? '', 'Ideas.md'))).toContain('The gate held.');
    await expect(editorContent(second)).toContainText('The gate held.');
    // Another window here wrote it: not news from another device, in either window.
    await expect(status(second)).not.toHaveClass(/is-other/);
    await expect(status(page)).not.toHaveClass(/is-other/);
  });

  test('a setting changed in one window reaches the other', async ({ app, page }) => {
    // The vault shown first: a menu command sent before the window hears the menu is lost.
    await expect(row(page, 'Ideas')).toBeVisible();
    const second = await newWindow(app);
    await expect(second.locator('html')).not.toHaveAttribute('data-layout', 'slip');
    await page.evaluate(() => window.eien.settings.set('appearance.layout', 'slip'));
    await expect(second.locator('html')).toHaveAttribute('data-layout', 'slip');
  });

  test('Close Window closes the window it’s for, and leaves the other', async ({ app, page }) => {
    await openNote(page, 'Ideas', 'Snow on the walls.');
    const second = await newWindow(app);
    await expect(editorContent(second)).toContainText('Snow on the walls.');
    const closed = second.waitForEvent('close');
    await clickMenuIn(app, 1, 'File', 'Close Window');
    await closed;
    expect(app.windows()).toHaveLength(1);
    await expect(editorContent(page)).toContainText('Snow on the walls.');
  });
});
