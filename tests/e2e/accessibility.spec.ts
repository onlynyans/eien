// axe-core over the window (./axe.ts): every layout, by day and by night,
// with three panes, two, and Settings open, the pointer over each pane in
// turn. No serious or critical violation, colour contrast included.

import type { Page } from '@playwright/test';
import { seriousViolations, violationsUnder } from './axe';
import { expect, test } from './launch';

test.use({
  vaultFiles: {
    'Note.md':
      '---\ntags: [draft]\n---\n# A heading\n\nWords on the *page*, and a [[Other]] link.\n',
    'Other.md': 'More words.\n',
    'Drafts/Chapter.md': 'A chapter.\n',
    'Table.md': 'Before.\n\n| Who | When |\n|---|--:|\n| Mara | 30 |\n| Levi | 41 |\n\nAfter.\n',
  },
});

/** The note open on the page, so the page's controls and the editor are there to check. */
async function ready(page: Page): Promise<void> {
  await page.locator('.note-row', { hasText: 'Note' }).click();
  await expect(page.locator('.title')).toHaveText('Note');
}

for (const layout of ['band', 'slip', 'runhead'] as const) {
  for (const scheme of ['day', 'night'] as const) {
    test.describe(`${layout} by ${scheme}`, () => {
      test.use({
        deviceFile: { settings: { 'appearance.layout': layout, 'appearance.scheme': scheme } },
      });

      test('three panes, two panes and Settings have no serious violation', async ({ page }) => {
        await ready(page);
        await expect(page.locator('html')).toHaveAttribute('data-layout', layout);
        expect(await violationsUnder(page, ['.sidebar', '.list', '.page']), 'three panes').toEqual(
          [],
        );

        await page.locator('[data-command="panes"]').click();
        await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
        expect(await violationsUnder(page, ['.sidebar', '.page']), 'two panes').toEqual([]);

        await page.getByRole('button', { name: 'Settings' }).click();
        const settings = page.getByRole('dialog', { name: 'Settings' });
        await expect(settings).toBeVisible();
        expect(await violationsUnder(page, ['dialog[open]']), 'Settings').toEqual([]);
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
