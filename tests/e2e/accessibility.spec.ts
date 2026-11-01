// axe-core over the window (./axe.ts): every layout, by day and by night,
// with three panes, the sidebar shut (the seal alone, or a strip of desk), two
// panes, and Settings open, the pointer over each pane in turn. No serious or
// critical violation, colour contrast included.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { seriousViolations, violationsUnder } from './axe';
import { chooseSetting, clickMenu, expect, ROOT, test } from './launch';

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
    // A folder in it on SHELF, which the book's test shuts (#40).
    'Novels/Russian/Anna Karenina.epub': readFileSync(join(ROOT, 'tests/fixtures/epub/plain.epub')),
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
        app,
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
        // A bookmarked page (#40, Phase 4b): its mark, and the tool pressed.
        await page.locator('.page__leaf--epub .page__scroll').focus();
        await page.keyboard.press('b');
        await expect(page.locator('.page__mark--bookmark[data-edge="right"]')).toBeVisible();
        expect(await violationsUnder(page, ['.page']), 'a bookmarked page').toEqual([]);
        // A highlight (Phase 5a): words chosen and H, their tick in the margin; then taken off,
        // the colophon's Put back offered.
        /** The chapter's first words chosen, as a hand leaves them. */
        const chooseWords = () =>
          page.evaluate(() => {
            const chapter = document.querySelector('.page__leaf--epub .epub-chapter p');
            const words = chapter?.firstChild;
            if (!words) throw new Error('no words');
            const range = document.createRange();
            range.setStart(words, 0);
            range.setEnd(words, Math.min(12, words.textContent?.length ?? 0));
            document.getSelection()?.removeAllRanges();
            document.getSelection()?.addRange(range);
          });
        await chooseWords();
        await page.keyboard.press('h');
        await expect(page.locator('.epub-chapter [data-highlighted]')).toHaveCount(1);
        expect(await violationsUnder(page, ['.page']), 'a highlighted page').toEqual([]);
        // Kept, its words are let go: chosen again, H takes it off.
        await chooseWords();
        await page.keyboard.press('h');
        await expect(page.getByRole('button', { name: 'Put back' })).toBeVisible();
        expect(await violationsUnder(page, ['.page']), 'Put back in the colophon').toEqual([]);
        await page.getByRole('button', { name: 'Put back' }).click();
        await expect(page.locator('.epub-chapter [data-highlighted]')).toHaveCount(1);
        // Marks in the list (Phase 4c, 5b): the book's lenses, its bookmark and highlight rows.
        await page.getByRole('button', { name: /^Marks \d+$/u }).click();
        await expect(page.locator('.mark-row')).toHaveCount(2);
        expect(await violationsUnder(page, ['.list']), 'Marks in the list').toEqual([]);
        // Find (Phase 5c): the list's field searching the book, its matches under Found; and the
        // page's own find bar over the book, its matches inked.
        const searchBook = page.getByRole('searchbox', { name: 'Search Pride and Prejudice' });
        await searchBook.fill('the');
        await expect(page.locator('.found-row').first()).toBeVisible();
        expect(await violationsUnder(page, ['.list']), 'Found in the list').toEqual([]);
        await searchBook.fill('');
        await page.locator('.page__leaf--epub .page__scroll').focus();
        // ⌘F is the menu's, which Playwright's keys never reach: its Find, clicked.
        await clickMenu(app, 'Edit', 'Find', 'Find…');
        const findBar = page.getByRole('search', { name: 'Find in the book' });
        await findBar.getByRole('textbox', { name: 'Find' }).fill('Bennet');
        await expect(findBar.locator('.find__count')).toHaveText(/of/u);
        expect(await violationsUnder(page, ['.page']), 'the find bar over a book').toEqual([]);
        await findBar.getByRole('textbox', { name: 'Find' }).press('Escape');
        await page.getByRole('button', { name: /^Contents \d+$/u }).click();
        // Marks on the edge (Phase 4d), from the shelf's look: the strip beside the page.
        const lookTool = page.locator(
          '[data-command="look"]:not(.phone-bar__controls *, .page__phone *)',
        );
        await lookTool.click();
        await page.locator('[data-setting="epub.marks"] [data-value="edge"]').click();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('slider', { name: 'The whole book' })).toBeVisible();
        expect(await violationsUnder(page, ['.page']), 'the strip').toEqual([]);
        // Its tip shows only under the pointer (QA): its words checked too, by day and night.
        await page.getByRole('slider', { name: 'The whole book' }).hover();
        await expect(page.locator('.edge-strip__tip')).toBeVisible();
        expect(await seriousViolations(page), 'the strip’s tip').toEqual([]);
        await lookTool.click();
        await page.locator('[data-setting="epub.marks"] [data-value="list"]').click();
        await page.keyboard.press('Escape');
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
        // A folder on SHELF shut, and the folder's menu from its row there (#40).
        await page.locator('[data-key="twist:/shelf/Novels/Russian"]').click();
        await expect(page.locator('[data-key="shelf:Novels/Russian"]')).toHaveAttribute(
          'aria-expanded',
          'false',
        );
        expect(await violationsUnder(page, ['.sidebar']), 'a folder shut on SHELF').toEqual([]);
        await page.locator('[data-key="shelf:Novels"]').click({ button: 'right' });
        await expect(page.getByRole('menu', { name: 'Novels' })).toBeVisible();
        expect(await violationsUnder(page, ['.menu']), 'a folder’s menu on SHELF').toEqual([]);
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
        // Marks with none kept (Phase 4c): the list's empty line, in pencil.
        await page.getByRole('button', { name: /^Marks \d+$/u }).click();
        await expect(page.locator('.list__empty')).toHaveText(
          'Nothing kept yet. B bookmarks a page; H keeps the words you choose.',
        );
        expect(await violationsUnder(page, ['.list']), 'Marks with none kept').toEqual([]);
        await page.getByRole('button', { name: /^Contents \d+$/u }).click();
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
        // Marks on SHELF with two panes (Phase 4c, 5b): the lenses a line under the book's row, the
        // bookmark and highlight made above tree rows, each its page its count.
        await page
          .locator('.tree-lenses')
          .getByRole('button', { name: /^Marks \d+$/u })
          .click();
        await expect(page.locator('.tree-row--mark')).toHaveCount(2);
        expect(await violationsUnder(page, ['.sidebar']), 'Marks on SHELF').toEqual([]);
      });

      test('a book in pages, its edges and the Pages and Scroll tools, has no serious violation (#40, Phase 3b)', async ({
        page,
        app,
      }) => {
        await page
          .locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' })
          .click();
        await expect(page.locator('.epub-chapter')).toContainText('It is a truth');
        await clickMenu(app, 'View', 'Pages');
        await expect(page.locator('.page__leaf--epub')).toHaveAttribute('data-view', 'pages');
        await page.locator('.page__leaf--epub .page__scroll').focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.epub-edges__stack--before .epub-edges__edge')).not.toHaveCount(
          0,
        );
        expect(
          await violationsUnder(page, ['.page', '.epub-edges__turn']),
          'a book in pages, its edges',
        ).toEqual([]);
      });

      test('a book open to two pages set as a book, and its title page and imprint, have no serious violation (#40, Phase 3d)', async ({
        page,
        app,
      }) => {
        await page
          .locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' })
          .click();
        await expect(page.locator('.epub-chapter')).toContainText('It is a truth');
        await clickMenu(app, 'View', 'Pages');
        // The list shut and the window wide: room for two pages of 20em.
        await clickMenu(app, 'View', 'Toggle Note List');
        await page.setViewportSize({ width: 1900, height: 900 });
        const pages = page.locator('.page__leaf--epub .epub-sheet:not([aria-hidden]) .epub__pages');
        await expect(pages).toHaveAttribute('data-spread', '');
        // The panes' widths move over the calm time as the list shuts: a page turned mid-move is
        // laid out again where its place falls once they hold still.
        let width = -1;
        await expect
          .poll(async () => {
            const now = (await pages.boundingBox())?.width ?? 0;
            const still = now > 0 && now === width;
            width = now;
            return still;
          })
          .toBe(true);
        await page.locator('.page__leaf--epub .page__scroll').focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.epub-heads__item').first()).toHaveText('Pride and Prejudice');
        expect(await violationsUnder(page, ['.page', '.epub-edges__turn']), 'a spread').toEqual([]);
        // Back to Eien's title page and imprint, before the book's first page. QA (#40, Phase 3d): in
        // sight, not merely drawn, as the book's first item holds them on every page of it.
        const titleInSight = () =>
          pages.evaluate((element) => {
            const title = element.querySelector('[aria-label="Title page"]');
            const rect = title?.getBoundingClientRect();
            const sight = element.getBoundingClientRect();
            return (
              rect !== undefined &&
              rect.width > 0 &&
              rect.left >= sight.left - 1 &&
              rect.right <= sight.right + 1
            );
          });
        for (let i = 0; i < 8 && !(await titleInSight()); i++) {
          await page.keyboard.press('ArrowLeft');
          await page.waitForTimeout(100);
        }
        await expect.poll(titleInSight).toBe(true);
        expect(await violationsUnder(page, ['.page']), 'the title page and imprint').toEqual([]);
      });

      test('a book beside a note, words chosen in it with the selection bar, has no serious violation (#40)', async ({
        page,
      }) => {
        await ready(page);
        await otherRow(page).click({ modifiers: ['ControlOrMeta'] });
        await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
        await page
          .locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' })
          .click();
        const chapter = page.locator('.epub-chapter');
        await expect(chapter).toContainText('It is a truth universally acknowledged');
        await chapter.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element.querySelector('p:nth-of-type(2)') as Node);
          document.getSelection()?.removeAllRanges();
          document.getSelection()?.addRange(range);
        });
        await chapter.dispatchEvent('mouseup');
        await expect(page.getByRole('toolbar', { name: 'The selection' })).toBeVisible();
        expect(await seriousViolations(page), 'a book beside a note').toEqual([]);
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

// Text size at its smallest (#72): the words at half, every row and control still a target's size,
// in both densities (a compact row is the smaller).
for (const density of ['comfortable', 'compact'] as const) {
  test.describe(`text size 50%, ${density}`, () => {
    test.use({
      deviceFile: { settings: { 'appearance.textSize': 50, 'appearance.density': density } },
    });

    test('three panes, two panes, a book’s contents and Settings have no serious violation', async ({
      page,
    }) => {
      await ready(page);
      await expect(page.locator('html')).toHaveCSS('--eien-text-scale', '0.5');
      expect(await violationsUnder(page, ['.sidebar', '.list', '.page']), 'three panes').toEqual(
        [],
      );
      await page
        .locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' })
        .click();
      await expect(page.locator('.contents-row').first()).toBeVisible();
      expect(await violationsUnder(page, ['.sidebar', '.list']), 'a book’s contents').toEqual([]);

      await page.locator('[data-command="panes"]').click();
      await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
      expect(await violationsUnder(page, ['.sidebar']), 'two panes').toEqual([]);

      await page.getByRole('button', { name: 'Settings' }).click();
      await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
      expect(await violationsUnder(page, ['dialog[open]']), 'Settings').toEqual([]);
    });
  });
}
