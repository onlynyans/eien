// axe-core over the window (./axe.ts): every layout, by day and by night,
// with three panes, two, and Settings open, the pointer over each pane in
// turn. No serious or critical violation, colour contrast included.

import type { Page } from '@playwright/test';
import { violationsUnder } from './axe';
import { expect, test } from './launch';

test.use({
  vaultFiles: {
    'Note.md':
      '---\ntags: [draft]\n---\n# A heading\n\nWords on the *page*, and a [[Other]] link.\n',
    'Other.md': 'More words.\n',
    'Drafts/Chapter.md': 'A chapter.\n',
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
