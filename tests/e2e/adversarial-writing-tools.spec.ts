// Adversarial: phase 9a's writing tools on the real app (spec §4, §6), where
// a unit test can't show the defect: what the page draws, and the View menu's
// checks. Each test's comment says the defect it caught, as it was before the
// fix; each was shown to fail without its fix.

import { chmodSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, expect, test } from './launch';

test.use({
  vaultFiles: {
    'Table.md': 'First paragraph.\n\n| Name | Age |\n|---|---|\n| Mara | 30 |\n\nLast paragraph.\n',
  },
});

async function open(page: Page, title: string): Promise<void> {
  await page.locator('.note-row', { hasText: title }).click();
  await expect(page.locator('.title')).toHaveText(title);
}

/** Whether the View menu's item is checked. */
const checked = (app: ElectronApplication, id: string) =>
  app.evaluate(
    ({ Menu }, id) => Menu.getApplicationMenu()?.getMenuItemById(`toggle:${id}`)?.checked,
    id,
  );

/** How faint `selector` (in the editor's shadow root) shows: its opacity times every ancestor's. */
const shownOpacity = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const root = (document.querySelector('.editor-host') as HTMLElement).shadowRoot;
    let node: Element | null = root?.querySelector(selector) ?? null;
    if (!node) return Number.NaN;
    let opacity = 1;
    while (node) {
      opacity *= Number(getComputedStyle(node).opacity);
      const parent: Node | null = node.parentNode;
      node = parent instanceof ShadowRoot ? parent.host : (parent as Element | null);
      if (node && !(node instanceof Element)) node = null;
    }
    return opacity;
  }, selector);

test.describe('focus mode', () => {
  test.use({ deviceFile: { settings: { 'editor.focus': 'on' } } });

  test('a table in Live fades back with the other paragraphs', async ({ page }) => {
    // The defect: focus mode dims `.cm-line`s, but Live draws a table as a block widget, which
    // isn't a line, so every table stays at full strength while the paragraphs round the
    // caret fade: the brightest thing on the page is the one the writer isn't writing.
    await open(page, 'Table');
    await page.locator('.cm-line', { hasText: 'Last paragraph.' }).click();
    await expect(page.locator('.cm-editor')).toHaveClass(/eien-focus/);
    await expect(page.locator('.eien-table-row').first()).toBeVisible();
    await expect.poll(() => shownOpacity(page, '.cm-line')).toBeLessThan(1); // "First paragraph."
    await expect.poll(() => shownOpacity(page, '.eien-table-row')).toBeLessThan(1);
  });
});

test.describe('the View menu’s check', () => {
  test('stays with the setting when the click reaches no window', async ({ app, page }) => {
    // The defect: Electron flips a checkbox item's check on every click, before the click handler
    // runs; the handler only sends the toggle to a focused BrowserWindow. With none (macOS,
    // the window closed, the app still in the menu bar) the check flips and the setting
    // doesn't, and nothing puts it back: the menu says Focus Mode is on when it's off.
    await open(page, 'Table');
    await app.evaluate(({ Menu }) => {
      Menu.getApplicationMenu()
        ?.getMenuItemById('toggle:editor.focus')
        ?.click(undefined, undefined);
    });
    await page.waitForTimeout(500);
    await expect(page.locator('.cm-editor')).not.toHaveClass(/eien-focus/);
    expect(await checked(app, 'editor.focus')).toBe(false);
  });

  test.describe('when the setting can’t be saved', () => {
    test.use({ deviceFile: {} });
    test.skip(
      process.platform === 'win32' || process.getuid?.() === 0,
      'chmod can’t make a file unreadable here',
    );

    test('the check goes back with it', async ({ app, page, userData }) => {
      // The defect: the save is refused (settings.json unreadable for a moment), the window falls
      // back to "off", but checkToggles only runs after a save that worked, so the check
      // Electron flipped on the click stays on.
      await open(page, 'Table');
      const file = join(userData, 'settings.json');
      expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({});
      chmodSync(file, 0o000);
      try {
        await clickMenu(app, 'View', 'Focus Mode');
        await page.waitForTimeout(500);
        await expect(page.locator('.cm-editor')).not.toHaveClass(/eien-focus/);
        expect(await checked(app, 'editor.focus')).toBe(false);
      } finally {
        chmodSync(file, 0o644);
      }
    });
  });
});
