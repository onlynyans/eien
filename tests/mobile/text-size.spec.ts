// Text size at its smallest, 50% (#72), on a wide screen with a mouse: the
// desktop's panes as a pointer meets them. The words shrink; the rows and
// controls keep a target's size (WCAG 2.5.8's 24px, which axe checks among the
// rest), in either density, over the notes, a book's contents and Settings.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { seriousViolations } from '../e2e/axe';
import { open, putBytesOutside, putOutside, titles } from './outside';

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');

test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 860 } });

/** The panes at 50%, in `density`, over a few notes and a book. */
async function smallest(page: Page, density: 'comfortable' | 'compact'): Promise<void> {
  await open(page);
  await page.evaluate(async (density) => {
    await window.eien.settings.set('appearance.room', 'panes');
    // The note list too (a phone starts with two panes, #69), read as the window starts below.
    await window.eien.settings.set('layout.panes', 'three');
    await window.eien.settings.set('appearance.density', density);
    await window.eien.settings.set('appearance.textSize', 50);
  }, density);
  await putOutside(page, 'Eien/Vault/Fic/Tear.md', '# Tear\n\nThe scarf caught on the gate.\n');
  await putOutside(page, 'Eien/Vault/Fic/Mend.md', '# Mend\n\nShe mended it by the fire.\n');
  await putOutside(page, 'Eien/Vault/Ideas.md', '---\ntags: [draft]\n---\nAn idea.\n');
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await page.reload();
  await expect(page.locator('.shell')).toHaveAttribute('data-room', 'panes');
  await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'three');
  await expect(titles(page)).toHaveCount(3, { timeout: 10_000 });
  await expect(page.locator('html')).toHaveCSS('--eien-text-scale', '0.5');
}

for (const density of ['comfortable', 'compact'] as const) {
  test(`at 50%, ${density}: the panes, a book's contents and Settings keep every target`, async ({
    page,
  }) => {
    await smallest(page, density);
    // A tree row is a target's height, though its words are half their size.
    const row = page.locator('.sidebar .tree-row').first();
    expect((await row.boundingBox())?.height).toBeGreaterThanOrEqual(24);
    await titles(page).filter({ hasText: 'Tear' }).click();
    await expect(page.locator('.page .title')).toHaveText('Tear');
    expect(await seriousViolations(page), 'three panes').toEqual([]);

    await page.locator('[data-command="panes"]').click();
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
    expect(await seriousViolations(page), 'two panes').toEqual([]);
    await page.locator('[data-command="panes"]').click();

    await page
      .locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' })
      .click();
    await expect(page.locator('.contents-row').first()).toBeVisible({ timeout: 10_000 });
    expect(await seriousViolations(page), 'a book’s contents').toEqual([]);

    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    expect(await seriousViolations(page), 'Settings').toEqual([]);
  });
}

test('a book at 50% in pages: whole lines, and a turn there and back keeps its page', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(async () => {
    await window.eien.settings.set('appearance.room', 'panes');
    await window.eien.settings.set('epub.view', 'pages');
    await window.eien.settings.set('epub.turnSpeed', '0');
    await window.eien.settings.set('epub.appearance.textSize', 50);
  });
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await page.reload();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  const leaf = page.locator('.page__leaf--epub');
  const box = leaf.locator('.epub-sheet:not([aria-hidden]) .epub__pages');
  const chapter = box.locator('.epub-chapter');
  await expect(chapter).toContainText('It is a truth universally');
  await expect(leaf).toHaveCSS('--eien-text-scale', '0.5');
  const { height, line } = await chapter.evaluate((element) => ({
    height: (element as HTMLElement).offsetHeight,
    line: Number.parseFloat(getComputedStyle(element).lineHeight),
  }));
  // Half the line it is at 100% (33px in Newsreader).
  expect(line).toBeLessThan(20);
  expect(Number.isInteger(height / line)).toBe(true);

  /** The first words in sight: what's at the box's top left. */
  const firstWords = () =>
    box.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const at = document.caretRangeFromPoint(rect.left + 2, rect.top + 4);
      return at?.startContainer.textContent?.slice(at.startOffset, at.startOffset + 30) ?? '';
    });
  const first = await firstWords();
  await leaf.locator('.page__scroll').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(firstWords).not.toBe(first);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(firstWords).toBe(first);
});
