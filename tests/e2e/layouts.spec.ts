// The three layouts (backlog #28; docs/design/explorations/overall.md): A ·
// Band, B · Slip and C · Running head, a device setting. Each draws every
// control once, each control reachable from the keyboard with its name and
// tooltip; each sets its own corners; and switching from one to another in
// Settings loses no control, and leaves the keyboard where it was.

import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, expect, test } from './launch';

test.use({ vaultFiles: { 'Note.md': 'Words on the page.\n', 'Other.md': 'More words.\n' } });

type Layout = 'band' | 'slip' | 'runhead';
const LAYOUTS: readonly Layout[] = ['band', 'slip', 'runhead'];

/** Every control the desktop draws, by command; C's running head never hides, so has no strip. */
const COMMANDS = [
  'pane.sidebar',
  'pane.list',
  'view.live',
  'view.source',
  'view.reading',
  'compare',
  'seal',
  'versions',
  'format-bar',
  'focus',
  'scheme',
  'panes',
  'settings',
];
const commandsOf = (layout: Layout) => (layout === 'runhead' ? COMMANDS : [...COMMANDS, 'strip']);
/** Each layout's corners (system.md, "Layouts"). */
const CORNERS: Record<Layout, [string, string, string]> = {
  band: ['2px', '4px', '8px'],
  slip: ['4px', '8px', '14px'],
  runhead: ['3px', '6px', '10px'],
};
const MAC = process.platform === 'darwin';

/** The desktop's control for `command`; the layout's phone bottom, hidden here, has its own. */
const control = (page: Page, command: string) =>
  page.locator(`[data-command="${command}"]:not(.phone-bar__controls *, .page__phone *)`);

/** A note open, and sealed, so Compare has something to show and every control can be used. */
async function ready(app: ElectronApplication, page: Page): Promise<void> {
  await page.locator('.note-row', { hasText: 'Note' }).click();
  await expect(page.locator('.title')).toHaveText('Note');
  await clickMenu(app, 'File', 'Seal');
  await expect(page.locator('.seal-line')).toHaveText('Sealed just now');
  await expect(control(page, 'compare')).toBeEnabled();
}

/** The commands the keyboard reaches by Tab alone, from the sidebar's seal round the window. */
async function tabbedTo(page: Page, wanted: readonly string[]): Promise<string[]> {
  const reached = new Set<string>();
  await page.locator('.sidebar__head .seal-button').focus();
  for (let press = 0; press < 150 && wanted.some((id) => !reached.has(id)); press++) {
    await page.keyboard.press('Tab');
    const command = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset.command ?? null,
    );
    if (command) reached.add(command);
  }
  return [...reached].sort();
}

/** How many of `command`'s controls are in sight (a phone's are hidden on the desktop). */
const shownCount = (page: Page, command: string) =>
  page.evaluate(
    (command) =>
      [...document.querySelectorAll<HTMLElement>(`[data-command="${command}"]`)].filter((button) =>
        button.checkVisibility(),
      ).length,
    command,
  );

for (const layout of LAYOUTS) {
  test.describe(`the ${layout} layout`, () => {
    test.use({ deviceFile: { settings: { 'appearance.layout': layout } } });

    test('reaches every control from the keyboard, each named, with its tooltip and key', async ({
      app,
      page,
    }) => {
      await ready(app, page);
      await expect(page.locator('html')).toHaveAttribute('data-layout', layout);
      const wanted = commandsOf(layout);
      expect(await tabbedTo(page, wanted)).toEqual([...wanted].sort());
      for (const command of wanted) {
        expect(await shownCount(page, command), command).toBe(1);
        await expect(control(page, command)).toHaveAttribute('aria-label', /\w/);
        await expect(control(page, command)).toHaveAttribute('data-tip', /\w/);
      }
      // The keyboard on a control shows its tooltip: its words, then its key.
      await control(page, 'seal').focus();
      await expect(page.locator('.tooltip')).toBeVisible();
      await expect(page.locator('.tooltip__words')).toHaveText('Seal this version');
      await expect(page.locator('.tooltip__key')).toHaveText(MAC ? '⌘S' : 'Ctrl+S');
      await expect(control(page, 'seal')).toHaveAttribute(
        'aria-keyshortcuts',
        MAC ? 'Meta+S' : 'Control+S',
      );
    });

    test('sets its own corners', async ({ page }) => {
      await expect(page.locator('.shell')).toBeVisible();
      const corners = await page.evaluate(() =>
        ['s', 'm', 'l'].map((step) =>
          getComputedStyle(document.documentElement)
            .getPropertyValue(`--eien-radius-${step}`)
            .trim(),
        ),
      );
      expect(corners).toEqual(CORNERS[layout]);
    });

    test('its controls do what they say', async ({ app, page }) => {
      await ready(app, page);
      await page.getByRole('button', { name: 'Source', exact: true }).click();
      await expect(control(page, 'view.source')).toHaveAttribute('aria-pressed', 'true');
      await expect(control(page, 'view.live')).toHaveAttribute('aria-pressed', 'false');
      await clickMenu(app, 'View', 'Next View'); // the menu's choice shows on the control too
      await expect(control(page, 'view.reading')).toHaveAttribute('aria-pressed', 'true');

      await control(page, 'focus').click();
      await expect(control(page, 'focus')).toHaveAttribute('aria-pressed', 'true');
      await control(page, 'versions').click();
      await expect(page.getByRole('complementary', { name: 'Versions' })).toBeVisible();
      await expect(control(page, 'versions')).toHaveAttribute('aria-pressed', 'true');

      await control(page, 'pane.sidebar').click();
      await expect(page.locator('.sidebar__vault')).toBeHidden();
      await expect(control(page, 'pane.sidebar')).toHaveAttribute('aria-pressed', 'false');
      await control(page, 'pane.sidebar').click();
      await expect(page.locator('.sidebar__vault')).toBeVisible();
    });
  });
}

for (const layout of ['band', 'slip'] as const) {
  test.describe(`the ${layout} layout’s strip`, () => {
    test.use({ deviceFile: { settings: { 'appearance.layout': layout } } });

    test('hides the page’s controls but its own, and is kept after a restart', async ({
      app,
      page,
    }) => {
      await ready(app, page);
      await control(page, 'strip').click();
      await expect(page.locator('.shell')).toHaveAttribute('data-strip-shut', '');
      await expect(control(page, 'seal')).toBeHidden();
      await expect(control(page, 'view.live')).toBeHidden();
      await expect(control(page, 'strip')).toHaveAttribute('data-tip', 'Show the controls');
      // Still the keyboard's: Tab reaches it, and Enter brings the rest back.
      await control(page, 'strip').focus();
      await page.keyboard.press('Enter');
      await expect(control(page, 'seal')).toBeVisible();
      await expect(control(page, 'strip')).toBeFocused();
      await control(page, 'strip').click();
      await page.reload();
      await expect(page.locator('.shell')).toHaveAttribute('data-strip-shut', '');
    });
  });
}

test('switching layouts in Settings loses no control, and gives the keyboard back to Settings', async ({
  page,
}) => {
  await expect(page.locator('.note-row').first()).toBeVisible();
  for (const layout of ['slip', 'runhead', 'band'] as const) {
    await control(page, 'settings').focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await expect(dialog).toBeVisible();
    await dialog.locator(`[data-value="${layout}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-layout', layout);
    for (const command of commandsOf(layout)) {
      expect(await shownCount(page, command), `${layout}: ${command}`).toBe(1);
    }
    if (layout === 'runhead') expect(await page.locator('[data-command="strip"]').count()).toBe(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(control(page, 'settings')).toBeFocused();
  }
});

test.describe('the running head', () => {
  test.use({
    deviceFile: { settings: { 'appearance.layout': 'runhead' } },
    vaultFiles: { 'Fic/Note.md': 'Words on the page.\n' },
  });

  test('runs across the window, 40px, with the breadcrumb, over the sidebar and the page', async ({
    page,
  }) => {
    await page.locator('.note-row', { hasText: 'Note' }).click();
    const head = page.locator('.window-head');
    await expect(head).toBeVisible();
    const box = await head.boundingBox();
    expect(box?.height).toBe(40);
    expect(box?.x).toBe(0);
    expect(box?.width).toBe(await page.evaluate(() => innerWidth));
    const crumbs = (await page.locator('.sheet .crumbs').textContent()) ?? '';
    expect(crumbs).not.toBe('');
    await expect(head.locator('.running-crumbs')).toHaveText(crumbs);
    const sidebar = await page.locator('.sidebar').boundingBox();
    expect(sidebar?.y).toBe(40);
    await expect(page.locator('.page__bar')).toBeHidden();
  });
});
