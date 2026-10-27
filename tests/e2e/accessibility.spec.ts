// axe-core over the window (./axe.ts): every layout, by day and by night,
// with three panes, the sidebar shut (the seal alone, or a strip of desk), two
// panes, and Settings open, the pointer over each pane in turn. No serious or
// critical violation, colour contrast included.

import type { Page } from '@playwright/test';
import { seriousViolations, violationsUnder } from './axe';
import { chooseSetting, expect, test } from './launch';

test.use({
  vaultFiles: {
    'Note.md':
      '---\ntags: [draft]\n---\n# A heading\n\nWords on the *page*, and a [[Other]] link.\n',
    'Other.md': 'More words.\n',
    'Drafts/Chapter.md': 'A chapter.\n',
    'Table.md': 'Before.\n\n| Who | When |\n|---|--:|\n| Mara | 30 |\n| Levi | 41 |\n\nAfter.\n',
  },
});

/** The other note's row, by its path: its title is in Note's words too ("[[Other]]"). */
const otherRow = (page: Page) => page.locator('.note-row[data-path="Other.md"]');

/** The note open on the page, so the page's controls and the editor are there to check. */
async function ready(page: Page): Promise<void> {
  await page.locator('.note-row', { hasText: 'Note' }).click();
  await expect(page.locator('.title')).toHaveText('Note');
}

/** The sidebar shut by its seal: what's left of it, and the panes beside it, checked. */
async function shutViolations(page: Page) {
  await page.locator('.sidebar__hide').click();
  await expect(page.locator('.sidebar__show')).toBeVisible();
  const found = await violationsUnder(page, ['.sidebar__strip', '.list', '.page']);
  await page.locator('.sidebar__show').click();
  await expect(page.locator('.sidebar__hide')).toBeVisible();
  return found;
}

for (const layout of ['band', 'slip', 'runhead'] as const) {
  for (const scheme of ['day', 'night'] as const) {
    test.describe(`${layout} by ${scheme}`, () => {
      test.use({
        deviceFile: { settings: { 'appearance.layout': layout, 'appearance.scheme': scheme } },
      });

      test('three panes, the sidebar shut, two panes and Settings have no serious violation', async ({
        page,
      }) => {
        await ready(page);
        await expect(page.locator('html')).toHaveAttribute('data-layout', layout);
        expect(await violationsUnder(page, ['.sidebar', '.list', '.page']), 'three panes').toEqual(
          [],
        );
        expect(await shutViolations(page), 'the sidebar shut').toEqual([]);

        await page.locator('[data-command="panes"]').click();
        await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
        expect(await violationsUnder(page, ['.sidebar', '.page']), 'two panes').toEqual([]);

        await page.getByRole('button', { name: 'Settings' }).click();
        const settings = page.getByRole('dialog', { name: 'Settings' });
        await expect(settings).toBeVisible();
        expect(await violationsUnder(page, ['dialog[open]']), 'Settings').toEqual([]);
      });

      test('split, and folded, has no serious violation', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        await ready(page);
        await otherRow(page).click({ modifiers: ['ControlOrMeta'] });
        await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
        // Each page, the divider (its ⇄ shows under the pointer) and the list's two marks.
        const areas = [
          '.page__leaf:not([data-active])',
          '.page__leaf[data-active]',
          '.divider',
          '.list',
        ];
        expect(await violationsUnder(page, areas), 'split').toEqual([]);
        await page.setViewportSize({ width: 1000, height: 800 });
        await expect(page.locator('.page__pages[data-narrow="fold"]')).toHaveCount(1);
        expect(await violationsUnder(page, ['.page']), 'folded, the pager showing').toEqual([]);
      });

      test('facing pages, and the book closed, have no serious violation', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        await ready(page);
        await chooseSetting(page, 'appearance.split', 'facing');
        await otherRow(page).click({ modifiers: ['ControlOrMeta'] });
        await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
        // Each page with its folio's tools in sight, the gutter, and the book's tools.
        const areas = [
          '.page__leaf[data-side="0"]',
          '.page__leaf[data-side="1"]',
          '.divider',
          '.page__bar',
        ];
        expect(await violationsUnder(page, areas), 'facing').toEqual([]);
        await page.setViewportSize({ width: 1000, height: 800 });
        await expect(page.locator('.page__pages[data-narrow="close"]')).toHaveCount(1);
        expect(await violationsUnder(page, ['.page']), 'the book closed, the edge showing').toEqual(
          [],
        );
      });

      test('a companion, beside and under the page, has no serious violation', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        await ready(page);
        await chooseSetting(page, 'appearance.split', 'companion');
        await otherRow(page).click({ modifiers: ['ControlOrMeta'] });
        await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
        // The companion with its head's tools in sight, and the page beside it resting.
        const areas = ['.page__leaf[data-side="1"]', '.page__leaf[data-side="0"]'];
        expect(await violationsUnder(page, areas), 'beside').toEqual([]);
        await page.setViewportSize({ width: 1200, height: 900 });
        await expect(page.locator('.page__pages[data-dock="under"]')).toHaveCount(1);
        expect(await violationsUnder(page, ['.page']), 'under the page').toEqual([]);
      });

      test('tools that follow, and a page waiting, have no serious violation', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        await ready(page);
        await chooseSetting(page, 'appearance.split', 'follow');
        await otherRow(page).click({ modifiers: ['ControlOrMeta'] });
        await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
        // The furniture over the active page, the other at rest, the tree listing the notes.
        const areas = ['.page__leaf[data-active]', '.page__leaf:not([data-active])', '.sidebar'];
        expect(await violationsUnder(page, areas), 'follow').toEqual([]);
        await page.setViewportSize({ width: 960, height: 800 });
        await expect(page.locator('.page__pages[data-narrow="wait"]')).toHaveCount(1);
        expect(await violationsUnder(page, ['.page']), 'a page waiting').toEqual([]);
      });
    });
  }
}

for (const scheme of ['day', 'night'] as const) {
  test.describe(`a table by ${scheme}`, () => {
    test.use({ deviceFile: { settings: { 'appearance.scheme': scheme } } });

    test('its grips, a + and its menus have no serious violation', async ({ page }) => {
      await page.locator('.note-row', { hasText: 'Table' }).click();
      await expect(page.locator('.title')).toHaveText('Table');
      await page.locator('.eien-cell', { hasText: 'Mara' }).click();
      await expect(
        page.getByRole('button', { name: 'Row 1: menu, or drag to move' }),
      ).toBeVisible();
      expect(await violationsUnder(page, ['.eien-table-row']), 'grips').toEqual([]);
      // On the line between the two columns, where its + shows.
      const add = page.getByRole('button', { name: 'Add a column between Who and When' });
      await add.hover();
      expect(await seriousViolations(page), 'a +').toEqual([]);
      await page.getByRole('button', { name: 'Column When: menu, or drag to move' }).click();
      await expect(page.getByRole('menu', { name: 'Column · When' })).toBeVisible();
      expect(await seriousViolations(page), 'a column’s menu').toEqual([]);
    });
  });
}

for (const scheme of ['day', 'night'] as const) {
  test.describe(`find by ${scheme}`, () => {
    test.use({ deviceFile: { settings: { 'appearance.scheme': scheme } } });

    test('its bar, Replace, an option on and the matches have no serious violation', async ({
      page,
    }) => {
      await ready(page);
      await page.locator('.cm-content').click();
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Alt+f' : 'Control+h');
      const bar = page.locator('.find');
      await expect(bar.getByRole('textbox', { name: 'Find' })).toBeFocused();
      await page.keyboard.type('Words');
      await expect(bar.getByRole('status')).toHaveText('1 of 1');
      await bar.getByRole('button', { name: 'Match case' }).click();
      await expect(bar.getByRole('status')).toHaveText('1 of 1');
      expect(await violationsUnder(page, ['.find', '.page']), 'find').toEqual([]);
      await bar.getByRole('button', { name: 'Pattern (regular expression)' }).click();
      await bar.getByRole('textbox', { name: 'Find' }).fill('Words(');
      await expect(bar.getByRole('status')).toHaveText('Not a valid pattern');
      expect(await seriousViolations(page), 'a pattern that can’t be read').toEqual([]);
    });
  });
}

// Shut sidebar's other choice, Band's and Slip's: a strip of desk, with its shoulder on macOS.
for (const layout of ['band', 'slip'] as const) {
  for (const scheme of ['day', 'night'] as const) {
    test.describe(`${layout}, a strip of desk, by ${scheme}`, () => {
      test.use({
        deviceFile: {
          settings: {
            'appearance.layout': layout,
            'appearance.scheme': scheme,
            'appearance.shutSidebar': 'strip',
          },
        },
      });

      test('the sidebar shut to its strip has no serious violation', async ({ page }) => {
        await ready(page);
        expect(await shutViolations(page)).toEqual([]);
      });
    });
  }
}
