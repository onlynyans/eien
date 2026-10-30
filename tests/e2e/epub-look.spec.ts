// A book's own look (#40, Phase 1c): with a book in front, the quick look
// (LOOK / SHELF) sets the shelf's typeface, size, line spacing, width and
// frame, worn by the book's page alone; a note's look never changes a book's,
// nor a book's a note's. Kept across a restart.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { seriousViolations } from './axe';
import { closeApp, expect, launchApp, ROOT, test } from './launch';

const look = (page: Page) =>
  page.locator('[data-command="look"]:not(.phone-bar__controls *, .page__phone *)');
const shelfLook = (page: Page) => page.getByRole('dialog', { name: 'Look: Shelf' });
const notesLook = (page: Page) => page.getByRole('dialog', { name: 'Look: Notes' });
const leaf = (page: Page) => page.locator('.page__leaf--epub');
const choose = (dialog: ReturnType<typeof shelfLook>, setting: string, value: string) =>
  dialog.locator(`[data-setting="${setting}"] [data-value="${value}"]`).click();

test.use({
  vaultFiles: {
    'Novels/Pride and Prejudice.epub': readFileSync(join(ROOT, 'tests/fixtures/epub/plain.epub')),
    'Notes.md': 'A note of my own.\n',
    'Chapter.md': 'The gate held.\n',
  },
});

const px = (value: string) => Number.parseFloat(value);
const fontOf = (locator: ReturnType<Page['locator']>, property: 'font-family' | 'font-size') =>
  locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);

test('the shelf’s look is the book’s alone, and the notes’ is the notes’', async ({
  page,
  app,
  userData,
  vault,
}) => {
  await page.locator('.tree-row--epub .tree-row__name').click();
  await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
  await look(page).click();
  const dialog = shelfLook(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('every book on the shelf');
  expect(await seriousViolations(page), 'the shelf’s look open').toEqual([]);
  await choose(dialog, 'appearance.face', 'literata');
  await choose(dialog, 'appearance.leading', 'loose');
  await choose(dialog, 'appearance.frame', 'full');
  await expect(leaf(page)).toHaveAttribute('data-face', 'literata');
  await expect(leaf(page)).toHaveAttribute('data-frame', 'full');
  await expect(leaf(page)).toHaveCSS('--look-lead', '1.12');
  // The window, and so a note, keeps the notes' look.
  await expect(page.locator('html')).not.toHaveAttribute('data-face', /./u);
  await expect(page.locator('html')).not.toHaveAttribute('data-frame', /./u);
  await page.keyboard.press('Escape');

  // A note's look changed: the book's stays.
  await page.locator('.tree-row__name', { hasText: /^All Notes/u }).click();
  await page.locator('.note-row', { hasText: 'Notes' }).click();
  await look(page).click();
  await choose(notesLook(page), 'appearance.face', 'plex-sans');
  await expect(page.locator('html')).toHaveAttribute('data-face', 'plex-sans');
  await page.keyboard.press('Escape');
  await page.locator('.tree-row--epub .tree-row__name').click();
  await expect(leaf(page)).toHaveAttribute('data-face', 'literata');

  await closeApp(app);
  const again = await launchApp(userData, vault);
  const next = await again.firstWindow();
  await next.locator('.tree-row--epub .tree-row__name').click();
  await expect(leaf(next)).toHaveAttribute('data-face', 'literata');
  await expect(leaf(next)).toHaveAttribute('data-frame', 'full');
  await closeApp(again);
});

test('the book’s type is its own on the page, its chapter title too', async ({ page }) => {
  await page.locator('.tree-row--epub .tree-row__name').click();
  const title = leaf(page).locator('[data-part="chapter-title"]');
  const words = leaf(page).locator('[data-part="first-line"]');
  await expect(title).toBeVisible();
  const before = {
    title: px(await fontOf(title, 'font-size')),
    words: px(await fontOf(words, 'font-size')),
  };
  await look(page).click();
  await choose(shelfLook(page), 'appearance.face', 'literata');
  await shelfLook(page).getByRole('button', { name: 'Larger' }).click();
  await page.keyboard.press('Escape');
  await expect.poll(() => fontOf(words, 'font-family')).toMatch(/Literata/u);
  // Literata at 110%, as the book's own: its title and words both change, from its own face.
  await expect.poll(async () => px(await fontOf(title, 'font-size'))).not.toBe(before.title);
  await expect.poll(async () => px(await fontOf(words, 'font-size'))).not.toBe(before.words);
  const settled = px(await fontOf(title, 'font-size'));
  // The notes' text size changed: the book's title stays as it was.
  await page.locator('.tree-row__name', { hasText: /^All Notes/u }).click();
  await page.locator('.note-row', { hasText: 'Notes' }).click();
  await look(page).click();
  await notesLook(page).getByRole('button', { name: 'Larger' }).click();
  await page.keyboard.press('Escape');
  await page.locator('.tree-row--epub .tree-row__name').click();
  await expect.poll(async () => px(await fontOf(title, 'font-size'))).toBe(settled);
});

test('beside a note, a book keeps its own type and the window’s frame', async ({ page }) => {
  await page.locator('.note-row', { hasText: 'Chapter' }).click();
  await page.locator('.note-row', { hasText: 'Notes' }).click({ modifiers: ['ControlOrMeta'] });
  await expect(page.locator('.page__leaf')).toHaveCount(2);
  // The book takes the active page's place, the note beside it stays.
  await page.locator('.tree-row--epub .tree-row__name').click();
  await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
  await look(page).click();
  await choose(shelfLook(page), 'appearance.face', 'literata');
  await choose(shelfLook(page), 'appearance.frame', 'full');
  await page.keyboard.press('Escape');
  await expect
    .poll(() => fontOf(leaf(page).locator('.epub-chapter'), 'font-family'))
    .toMatch(/Literata/u);
  const note = page.locator('.page__leaf:not(.page__leaf--epub) .cm-scroller');
  expect(await fontOf(note, 'font-family')).not.toMatch(/Literata/u);
  // Two pages lie in the window's frame: the book's leaf paints no ground of its own there.
  await expect(leaf(page)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(leaf(page).locator('.sheet')).not.toHaveCSS('box-shadow', 'none');
});

test('the shelf’s look says at its foot that Settings sets notes; the notes’ look says nothing', async ({
  page,
}) => {
  await page.locator('.tree-row--epub .tree-row__name').click();
  await look(page).click();
  const line = shelfLook(page).locator('.quick-look__foot .quick-look__line');
  await expect(line).toHaveText('Settings sets notes; this is every book’s look.');
  await expect(shelfLook(page)).toHaveAccessibleDescription(
    'Settings sets notes; this is every book’s look.',
  );
  // In the popover's own words: the text face, in pencil, as *every book on the shelf*.
  const every = shelfLook(page).locator('.quick-look__every');
  for (const property of ['font-family', 'font-style', 'color'] as const) {
    expect(await line.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property)).toBe(
      await every.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property),
    );
  }
  await page.keyboard.press('Escape');
  await page.locator('.tree-row__name', { hasText: /^All Notes/u }).click();
  await page.locator('.note-row', { hasText: 'Notes' }).click();
  await look(page).click();
  await expect(notesLook(page)).toBeVisible();
  await expect(notesLook(page).locator('.quick-look__line')).toHaveCount(0);
});

test.describe('the page the look doesn’t change', () => {
  /** The band's tone, as the window paints it. */
  const band = (page: Page) =>
    page.evaluate(() => {
      const probe = document.body.appendChild(document.createElement('div'));
      probe.style.background = 'var(--eien-band)';
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    });
  const paperOf = (locator: ReturnType<Page['locator']>) =>
    locator.evaluate((element) => getComputedStyle(element).backgroundColor);

  for (const [split, frame] of [
    ['sheets', 'sheet'],
    ['sheets', 'full'],
    ['facing', 'sheet'],
  ] as const) {
    test.describe(`${split}, ${frame}`, () => {
      test.use({
        deviceFile: { settings: { 'appearance.split': split, 'appearance.frame': frame } },
      });

      test('sits back while the look is open with a note and a book side by side', async ({
        page,
      }) => {
        await expect(page.locator('html')).toHaveAttribute('data-split', split);
        await page.locator('.note-row', { hasText: 'Chapter' }).click();
        await page
          .locator('.note-row', { hasText: 'Notes' })
          .click({ modifiers: ['ControlOrMeta'] });
        await page.locator('.tree-row--epub .tree-row__name').click();
        await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
        const note = page.locator('.page__leaf:not(.page__leaf--epub)');
        // The paper: the sheet, or the leaf where the leaf is the paper.
        const paper = split === 'facing' || frame === 'full' ? note : note.locator('.sheet');
        const resting = await paperOf(paper);
        expect(resting).not.toBe(await band(page));
        await look(page).click();
        await expect(shelfLook(page)).toBeVisible();
        await expect(note).toHaveAttribute('data-back', '');
        await expect(leaf(page)).not.toHaveAttribute('data-back');
        await expect.poll(() => paperOf(paper)).toBe(await band(page));
        await page.keyboard.press('Escape');
        await expect(note).not.toHaveAttribute('data-back');
        await expect.poll(() => paperOf(paper)).toBe(resting);
      });
    });
  }

  test.describe('companion', () => {
    test.use({ deviceFile: { settings: { 'appearance.split': 'companion' } } });

    test('the companion sits back while the book’s look is open', async ({ page }) => {
      await page.locator('.tree-row--epub .tree-row__name').click();
      await expect(leaf(page).locator('.epub-chapter')).toContainText('It is a truth');
      await page.locator('.tree-row__name', { hasText: /^All Notes/u }).click();
      await page.locator('.note-row', { hasText: 'Notes' }).click({ modifiers: ['ControlOrMeta'] });
      const note = page.locator('.page__leaf:not(.page__leaf--epub)');
      await expect(note).toHaveAttribute('data-side', '1');
      await expect(note).toHaveAttribute('data-active', '');
      // The Look control acts on the page itself, the book's, which becomes the one you're in.
      await look(page).click();
      await expect(shelfLook(page)).toBeVisible();
      await expect(leaf(page)).toHaveAttribute('data-active', '');
      await expect(note).toHaveAttribute('data-back', '');
      await expect.poll(() => paperOf(note)).toBe(await band(page));
    });
  });

  test('never sits back beside a note: two notes wear the one look', async ({ page }) => {
    await page.locator('.note-row', { hasText: 'Chapter' }).click();
    await page.locator('.note-row', { hasText: 'Notes' }).click({ modifiers: ['ControlOrMeta'] });
    await look(page).click();
    await expect(notesLook(page)).toBeVisible();
    await expect(page.locator('.page__leaf[data-back]')).toHaveCount(0);
  });
});
