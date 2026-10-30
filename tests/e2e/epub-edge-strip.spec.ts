// Marks on the edge wherever a book's page is laid out (#40, Phase 4d; QA):
// the strip stands at the page's outer edge, inside its leaf, in each split
// (Two sheets, Facing pages' right page and left, Companion) and in pages
// with Page frame Full, where there's no blotter round the sheet; and it
// never lies over the page's words in pages. What happy-dom can't lay out.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { clickMenu, expect, ROOT, test } from './launch';

const BOOK = new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/epub/plain.epub')));

const leaves = (page: Page) => page.locator('.page__pages > .page__leaf');
const book = (page: Page) => page.locator('.page__leaf--epub');
const strip = (page: Page) => book(page).getByRole('slider', { name: 'The whole book' });
const shelfBook = (page: Page) =>
  page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' });

/** The strip's box and its leaf's, as the window lays them out. */
async function boxes(page: Page) {
  const [leaf, edge] = await Promise.all([book(page).boundingBox(), strip(page).boundingBox()]);
  if (!leaf || !edge) throw new Error('no leaf or strip');
  return { leaf, edge };
}

/** The strip wholly inside its page's leaf, at the side given: its outer edge. */
async function standsAt(page: Page, side: 'left' | 'right'): Promise<void> {
  await expect(strip(page)).toBeVisible();
  const { leaf, edge } = await boxes(page);
  expect(edge.x).toBeGreaterThanOrEqual(leaf.x - 1);
  expect(edge.x + edge.width).toBeLessThanOrEqual(leaf.x + leaf.width + 1);
  const middle = leaf.x + leaf.width / 2;
  if (side === 'right') expect(edge.x).toBeGreaterThan(middle);
  else expect(edge.x + edge.width).toBeLessThan(middle);
}

test.use({
  vaultFiles: {
    'Novels/Pride and Prejudice.epub': BOOK,
    'At the Assembly.md': 'She hears it from two chairs away.\n',
  },
});
test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

/** A note on one page, the book beside it (⌘-click on its SHELF row). */
async function beside(page: Page): Promise<void> {
  await page.locator('.note-row', { hasText: 'At the Assembly' }).click();
  await shelfBook(page).click({ modifiers: ['ControlOrMeta'] });
  await expect(leaves(page)).toHaveCount(2);
  await expect(book(page).locator('.epub-chapter')).toContainText('It is a truth');
}

for (const split of ['sheets', 'facing', 'companion'] as const) {
  test.describe(`${split}, marks on the edge`, () => {
    test.use({
      deviceFile: { settings: { 'appearance.split': split, 'epub.marks': 'edge' } },
    });

    test('the book’s page beside a note has the strip at its outer edge, inside its leaf', async ({
      page,
    }) => {
      await beside(page);
      await expect(page.locator('html')).toHaveAttribute('data-split', split);
      // Beside the note: the right-hand page, its outer edge the right.
      await standsAt(page, 'right');
      // Only the book's page: the note's has none.
      await expect(page.locator('.edge-strip:visible')).toHaveCount(1);
    });
  });
}

test.describe('Facing pages, the book on the left page', () => {
  test.use({
    deviceFile: { settings: { 'appearance.split': 'facing', 'epub.marks': 'edge' } },
  });

  test('the strip stands at the left, the left page’s outer edge', async ({ app, page }) => {
    await beside(page);
    await clickMenu(app, 'View', 'Swap Pages');
    await expect(book(page)).toHaveAttribute('data-side', '0');
    await standsAt(page, 'left');
  });

  // A bug, marked (QA report): the tip stands to the strip's left whatever the
  // side (edge-strip.css, `.edge-strip__tip { right: calc(100% + …) }`), so on
  // the left page it opens outward, off the page, over the pane beside or past
  // the window. Remove `fail` once it opens inward.
  test('pointing at the strip shows its tip on the page, never off it', async ({ app, page }) => {
    test.fail();
    await beside(page);
    await clickMenu(app, 'View', 'Swap Pages');
    await expect(book(page)).toHaveAttribute('data-side', '0');
    const { leaf, edge } = await boxes(page);
    await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2);
    const tip = strip(page).locator('.edge-strip__tip');
    await expect(tip).toBeVisible();
    const at = await tip.boundingBox();
    if (!at) throw new Error('no tip');
    expect(at.x).toBeGreaterThanOrEqual(leaf.x);
  });
});

test.describe('in pages with Page frame Full, marks on the edge', () => {
  test.use({
    deviceFile: {
      settings: {
        'epub.marks': 'edge',
        'epub.view': 'pages',
        'epub.appearance.frame': 'full',
      },
    },
  });

  test('the strip stands inside the page, clear of its words', async ({ page }) => {
    await shelfBook(page).click();
    await expect(book(page)).toHaveAttribute('data-frame', 'full');
    await expect(book(page)).toHaveAttribute('data-view', 'pages');
    await standsAt(page, 'right');
    const words = await book(page)
      .locator('.epub-sheet:not([aria-hidden]) .epub__pages')
      .boundingBox();
    if (!words) throw new Error('no page');
    const { edge } = await boxes(page);
    expect(edge.x).toBeGreaterThanOrEqual(words.x + words.width - 1);
  });
});
