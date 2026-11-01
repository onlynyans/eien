// A page too narrow for its tools (backlog #36): three panes in a 900px
// window, with Windows' controls standing over the band's right end. The
// tools that don't fit fold behind a ⋯, so nothing runs under the system's
// controls or past the page, in each layout; the band shut keeps its way back.

import type { ElectronApplication, Page } from '@playwright/test';
import { expect, test } from './launch';

/** Windows' minimize, maximize and close, as the window controls overlay measures them there. */
const WINDOWS_CONTROLS = 138;

test.use({ vaultFiles: { 'Note.md': 'Words.\n' } });

/**
 * The window 900px wide, the system's controls at the bars' right as on Windows (on any system),
 * `controls` wide: Running head's strip spans the window, so only far wider ones crowd its tools.
 */
async function narrowWithWindowsControls(page: Page, app: ElectronApplication, controls: number) {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(900, 760),
  );
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(900);
  await page.waitForTimeout(300); // the overlay's own measure settles first (shell/controls-left.ts)
  await page.evaluate((width) => {
    document.documentElement.removeAttribute('data-controls-left');
    document.documentElement.style.setProperty('--controls-w', `${width}px`);
  }, controls);
  // The bars fold again when their ResizeObserver hears the new room, in the next frame: measured
  // before it, on a slow machine, the tools still stand where the old room had them.
  await page.evaluate(async () => {
    for (let frame = 0; frame < 2; frame++) await new Promise(requestAnimationFrame);
  });
}

for (const layout of ['band', 'slip', 'runhead'] as const) {
  test.describe(layout, () => {
    test.use({ deviceFile: { settings: { 'appearance.layout': layout } } });

    test('the tools that don’t fit fold behind a ⋯, clear of the system’s controls', async ({
      app,
      page,
    }) => {
      await page.locator('.note-row', { hasText: 'Note' }).click();
      const controls = layout === 'runhead' ? 5 * WINDOWS_CONTROLS : WINDOWS_CONTROLS;
      await narrowWithWindowsControls(page, app, controls);
      const bar = page.locator(layout === 'runhead' ? '.window-head' : '.page__bar');
      const drawn = await bar.evaluate((bar, controls) => {
        const box = bar.getBoundingClientRect();
        const style = getComputedStyle(bar);
        const left = box.left + Number.parseFloat(style.paddingLeft);
        // Inside the bar, and the bar inside its page (A's and B's) and the window.
        const room = bar.closest('.page')?.getBoundingClientRect().right ?? innerWidth;
        const right = Math.min(box.right - Number.parseFloat(style.paddingRight), room);
        const shown = [...bar.querySelectorAll<HTMLElement>('.host button')].filter((button) =>
          button.checkVisibility(),
        );
        return {
          outside: shown
            .filter((button) => {
              const at = button.getBoundingClientRect();
              return (
                at.left < left - 0.5 || at.right > right + 0.5 || at.right > innerWidth - controls
              );
            })
            .map((button) => button.getAttribute('aria-label')),
          folded: [...bar.querySelectorAll<HTMLElement>('.host [data-command][hidden]')].map(
            (button) => button.getAttribute('aria-label'),
          ),
        };
      }, controls);
      expect(drawn.outside).toEqual([]);
      expect(drawn.folded.length).toBeGreaterThan(0); // short of room: something folded
      await bar.getByRole('button', { name: 'More tools' }).click();
      await expect(page.locator('.menu [role^="menuitem"]')).toHaveText(
        drawn.folded.map((name) => name ?? ''),
      );
    });
  });
}

test.describe('band', () => {
  test.use({ deviceFile: { settings: { 'appearance.layout': 'band' } } });

  test('shut to its lip on a narrow page, the band keeps its way back', async ({ app, page }) => {
    await page.locator('.note-row', { hasText: 'Note' }).click();
    await narrowWithWindowsControls(page, app, WINDOWS_CONTROLS);
    const strip = page.locator('.page__bar [data-command="strip"]');
    await page.locator('.page').hover();
    await strip.click();
    await expect(page.locator('.shell')).toHaveAttribute('data-strip-shut', '');
    await expect(strip).toBeVisible();
    await strip.click();
    await expect(page.locator('.shell')).not.toHaveAttribute('data-strip-shut', '');
  });
});
