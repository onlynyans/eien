// Backlog #10 on the real app: the sync status at the sidebar's foot. A sync
// icon when Syncthing syncs the vault (its .stfolder marker), nothing when it
// doesn't; in pencil, "Changed on another device", when a note changes that
// this window didn't change, and quiet through the writer's own saves.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { editorContent, expect, test } from './launch';

const status = (page: import('@playwright/test').Page) =>
  page.locator('.sidebar__foot .sync-status');

test.describe('a vault Syncthing syncs', () => {
  test.use({
    vaultFiles: {
      '.stfolder': '', // the marker: a folder now, a file in older Syncthing
      'Ideas.md': 'Snow on the walls.\n',
    },
  });

  test('shows the sync icon, quiet; another device’s change turns it to news', async ({
    page,
    vault,
  }) => {
    await expect(status(page)).toBeVisible();
    await expect(status(page)).toHaveAttribute('aria-label', 'Synced · Syncthing');
    await expect(status(page)).not.toHaveClass(/is-other/);
    writeFileSync(join(vault ?? '', 'From the phone.md'), 'synced\n');
    await expect(status(page)).toHaveClass(/is-other/);
    await expect(status(page)).toHaveAttribute('aria-label', 'Changed on another device just now');
    // Hovered, it says so in Eien's tooltip.
    await status(page).hover();
    await expect(page.locator('.tooltip')).toContainText('Changed on another device');
  });

  test('the writer’s own typing, saved, never reads as another device', async ({ page }) => {
    await page.locator('.note-row', { hasText: 'Ideas' }).click();
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' More words.');
    await page.waitForTimeout(2500); // past the autosave and its echo from the watcher
    await expect(status(page)).not.toHaveClass(/is-other/);
  });
});

test.describe('a vault Syncthing doesn’t sync', () => {
  test.use({ vaultFiles: { 'Ideas.md': 'Snow.\n' } });

  test('shows nothing at all', async ({ page, vault }) => {
    await expect(page.locator('.note-row').first()).toBeVisible();
    writeFileSync(join(vault ?? '', 'From elsewhere.md'), 'x\n');
    await expect(page.locator('.note-row', { hasText: 'From elsewhere' })).toBeVisible();
    await expect(status(page)).toHaveCount(0);
  });
});
