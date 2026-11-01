// A Mac trackpad's swipe back on the real app (#70): with the panes shut,
// the first opens the list, the next the sidebar. Three fingers come as the
// window's own swipe event (sent here as the system would); two fingers as
// sideways wheel events, read only where the Mac's Swipe between pages says
// two fingers swipe.

import type { ElectronApplication, Page } from '@playwright/test';
import { expect, test } from './launch';

test.use({
  vaultFiles: { 'Fic/The Tear.md': 'The scarf catches.\n', 'Ideas.md': 'Snow on the walls.\n' },
});

const list = (page: Page) => page.locator('.shell > .list');
const shell = (page: Page) => page.locator('.shell');

/** A note open, the list and the sidebar shut by their own toggles. */
async function panesShut(page: Page): Promise<void> {
  await page.locator('.note-row__title', { hasText: 'Ideas' }).click();
  await page.locator('[data-command="pane.list"]').first().click();
  await page.locator('[data-command="pane.sidebar"]').first().click();
  await expect(list(page)).toHaveAttribute('inert', '');
  await expect(shell(page)).toHaveAttribute('data-sidebar-shut', '');
}

/** The window's swipe event, as macOS sends it for three fingers. */
const swipe = (app: ElectronApplication, direction: string) =>
  app.evaluate(
    ({ BrowserWindow }, direction) =>
      BrowserWindow.getAllWindows()[0]?.emit('swipe', {}, direction),
    direction,
  );

test('three fingers swiped back open the list, then the sidebar; the other ways nothing', async ({
  app,
  page,
}) => {
  await panesShut(page);
  await swipe(app, 'right');
  await swipe(app, 'up');
  await page.waitForTimeout(200);
  await expect(list(page)).toHaveAttribute('inert', '');
  await swipe(app, 'left');
  await expect(list(page)).not.toHaveAttribute('inert', '');
  await expect(shell(page)).toHaveAttribute('data-sidebar-shut', '');
  await swipe(app, 'left');
  await expect(shell(page)).not.toHaveAttribute('data-sidebar-shut');
});

test('two fingers swiped back open a pane where the Mac swipes between pages with two', async ({
  page,
}) => {
  const two = await page.evaluate(() => window.eien.window?.swipes());
  test.skip(!two, 'Swipe between pages is off for two fingers here (or this is not a Mac)');
  await panesShut(page);
  const box = await page.locator('.page').first().boundingBox();
  if (!box) throw new Error('no page');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // A scroll drifting sideways is a scroll.
  for (let step = 0; step < 12; step += 1) await page.mouse.wheel(-6, 40);
  await page.waitForTimeout(300);
  await expect(list(page)).toHaveAttribute('inert', '');
  for (let step = 0; step < 12; step += 1) await page.mouse.wheel(-20, 0);
  await expect(list(page)).not.toHaveAttribute('inert', '');
  await expect(shell(page)).toHaveAttribute('data-sidebar-shut', '');
});
