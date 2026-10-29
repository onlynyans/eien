// axe-core over the window (./axe.ts): every layout, by day and by night,
// with three panes, the sidebar shut (the seal alone, or a strip of desk), two
// panes, and Settings open, the pointer over each pane in turn. No serious or
// critical violation, colour contrast included.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { seriousViolations, violationsUnder } from './axe';
import { chooseSetting, expect, ROOT, test } from './launch';

test.use({
  vaultFiles: {
    'Note.md':
      '---\ntags: [draft]\n---\n# A heading\n\nWords on the *page*, and a [[Other]] link.\n',
    'Other.md': 'More words.\n',
    'Drafts/Chapter.md': 'A chapter.\n',
    'Table.md': 'Before.\n\n| Who | When |\n|---|--:|\n| Mara | 30 |\n| Levi | 41 |\n\nAfter.\n',
    // A book on the shelf (#40): SHELF is in every check of the sidebar.
    'Novels/Pride and Prejudice.epub': readFileSync(join(ROOT, 'tests/fixtures/epub/plain.epub')),
    'Novels/Links.epub': readFileSync(join(ROOT, 'tests/fixtures/epub/links.epub')),
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

      test('a book open, its contents in the list, has no serious violation (#40)', async ({
        page,
      }) => {
        await page
          .locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' })
          .click();
        await page.locator('.contents-row').nth(2).click();
        await expect(page.locator('.epub-chapter img')).toBeVisible();
        // A chapter a sheet (Phase 2): its foot in sight, the chapter before and "The end".
        const turns = page.getByRole('navigation', { name: 'Chapters' });
        await turns.scrollIntoViewIfNeeded();
        await expect(turns).toContainText('The end');
        expect(await violationsUnder(page, ['.sidebar', '.list', '.page']), 'three panes').toEqual(
          [],
        );
        // The shelf's look (#40, Phase 1c): LOOK / SHELF, with a book in front.
        await page
          .locator('[data-command="look"]:not(.phone-bar__controls *, .page__phone *)')
          .click();
        await expect(page.getByRole('dialog', { name: 'Look: Shelf' })).toBeVisible();
        await expect(page.locator('[data-setting="epub.scroll"]')).toBeVisible();
        // With its line at the foot: Settings sets notes.
        await expect(page.locator('.quick-look__line')).toBeVisible();
        expect(await seriousViolations(page), 'the shelf’s look').toEqual([]);
        await page.keyboard.press('Escape');
        // The book's row menu (rename, move, the trash in carmine).
        await page
          .locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' })
          .click({ button: 'right' });
        await expect(page.getByRole('menu', { name: 'Pride and Prejudice' })).toBeVisible();
        expect(await violationsUnder(page, ['.menu']), 'the book’s row menu').toEqual([]);
        await page.keyboard.press('Escape');
        // A note over the page (Phase 2b), and Back in the colophon after a link.
        await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Links' }).click();
        await page.locator('.epub-chapter sup a[href]').click();
        await expect(page.getByRole('dialog', { name: 'Note 1' })).toBeFocused();
        expect(await seriousViolations(page), 'a note over the page').toEqual([]);
        await page.keyboard.press('Escape');
        await page.getByRole('link', { name: 'see Chapter III' }).click();
        await expect(page.getByRole('button', { name: 'Back to Chapter I' })).toBeVisible();
        expect(await violationsUnder(page, ['.page']), 'Back in the colophon').toEqual([]);
        await page
          .locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' })
          .click();
        await page.locator('[data-command="panes"]').click();
        await expect(page.locator('.tree-row--chapter')).toHaveCount(3);
        expect(await violationsUnder(page, ['.sidebar', '.page']), 'two panes').toEqual([]);
      });

      test('the shelf’s look open beside a note, the note sitting back, has no serious violation', async ({
        page,
      }) => {
        await ready(page);
        await otherRow(page).click({ modifiers: ['ControlOrMeta'] });
        await expect(page.locator('.page__leaf')).toHaveCount(2);
        await page
          .locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' })
          .click();
        await expect(page.locator('.epub-chapter')).toContainText('It is a truth');
        await page
          .locator('[data-command="look"]:not(.phone-bar__controls *, .page__phone *)')
          .click();
        await expect(page.locator('.page__leaf[data-back]')).toHaveCount(1);
        // The note's words on the band's tone, the popover over them.
        expect(await seriousViolations(page), 'a note sitting back').toEqual([]);
      });

      test('the quick look open has no serious violation (#49)', async ({ page }) => {
        await ready(page);
        await page
          .locator('[data-command="look"]:not(.phone-bar__controls *, .page__phone *)')
          .click();
        const look = page.getByRole('dialog', { name: 'Look: Notes' });
        await expect(look).toBeVisible();
        // The popover, and its control kept in sight in its bar while it's open.
        expect(await violationsUnder(page, ['.quick-look']), 'the quick look').toEqual([]);
        expect(await seriousViolations(page), 'the window behind it').toEqual([]);
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

// A link's tools (#38), each way Link editing shows them: the card and its fields, the bar and
// its field, and In place's ↗.
for (const scheme of ['day', 'night'] as const) {
  for (const style of ['card', 'inline', 'bar'] as const) {
    test.describe(`a link's tools, ${style}, by ${scheme}`, () => {
      test.use({
        deviceFile: { settings: { 'appearance.scheme': scheme, 'editor.links': style } },
      });

      test('shown and edited, have no serious violation', async ({ page }) => {
        await ready(page);
        await page.locator('.eien-link', { hasText: 'Other' }).click();
        const tools = {
          card: page.getByRole('group', { name: 'Link to Other' }),
          inline: page.getByRole('button', { name: 'Open Other' }),
          bar: page.getByRole('toolbar', { name: 'Link to Other' }),
        }[style];
        await expect(tools).toBeVisible();
        expect(await seriousViolations(page), 'shown').toEqual([]);
        if (style === 'inline') return;
        await page.keyboard.press('ControlOrMeta+k');
        await expect(page.getByRole('textbox', { name: /^Goes to/ })).toBeVisible();
        expect(await seriousViolations(page), 'edited').toEqual([]);
      });
    });
  }
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
