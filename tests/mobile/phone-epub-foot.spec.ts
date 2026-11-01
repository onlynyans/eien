// A book's page takes the height it's given on a phone (#58): its sheet's
// foot margin is its head's, not a desk's 72px, in Pages and in Scroll, with
// the toolbar in sight or folded away; the sheet ends a gutter above the
// colophon, as it begins a gutter under the bar.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from '@playwright/test';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');

for (const view of ['pages', 'scroll'] as const) {
  for (const layout of ['band', 'slip', 'runhead'] as const) {
    test(`in ${view}, ${layout}: the sheet’s foot margin is its head’s`, async ({ page }) => {
      await open(page);
      await page.evaluate(
        async ([view, layout]) => {
          await window.eien.settings.set('epub.view', view);
          await window.eien.settings.set('appearance.layout', layout);
        },
        [view, layout] as const,
      );
      await putBytesOutside(
        page,
        'Eien/Vault/Novels/Pride and Prejudice.epub',
        readFileSync(FIXTURE).toString('base64'),
      );
      // A Galaxy Z Fold 5 opened upright.
      await page.setViewportSize({ width: 590, height: 706 });
      await page.reload();
      const back = page.locator('.phone-bar__back');
      const row = page.locator('.tree-row--epub .tree-row__name');
      await expect
        .poll(async () => (await row.isVisible()) || (await back.isVisible()), { timeout: 10_000 })
        .toBe(true);
      if (!(await row.isVisible())) await back.click();
      await row.click();
      await expect(page.locator('.epub-chapter')).toContainText('It is a truth');
      const sheet = page.locator('.epub-sheet:not([aria-hidden])');
      const margins = await sheet.evaluate((element) => {
        const style = getComputedStyle(element);
        return { head: style.paddingTop, foot: style.paddingBottom };
      });
      expect(margins.foot).toBe(margins.head);
      if (view === 'pages') {
        // The sheet ends a gutter above the colophon, as it begins one under the bar.
        const gaps = await sheet.evaluate((element) => {
          const scroll = element.closest('.page__scroll') as HTMLElement;
          const [at, within] = [element.getBoundingClientRect(), scroll.getBoundingClientRect()];
          return { above: at.top - within.top, below: within.bottom - at.bottom };
        });
        expect(gaps.below).toBeCloseTo(gaps.above, 0);
      }
    });
  }
}
