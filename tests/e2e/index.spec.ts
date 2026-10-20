// Phase 6a on the real app: what the vault's index shows — previews, a
// book's words, tags in the sidebar, search — and how it keeps up with
// typing, other programs, and a large vault (spec §2, §4, §11).

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import {
  clickMenu,
  closeApp,
  editorContent,
  expect,
  launchApp,
  makeVault,
  TIMING,
  test,
} from './launch';

const FILES = {
  'Fic/Scarf/The Tear.md':
    '---\ntags: [fic/aot]\n---\n# The Tear\n\nThe scarf **catches** on a nail.\n',
  'Fic/Scarf/Seventeen.md': '"Look," he begins more softly. #fic/aot/levi #draft\n',
  'Fic/Scarf/.eien-folder.json': JSON.stringify({
    order: ['The Tear.md', 'Seventeen.md'],
    book: {},
  }),
  'Ideas.md':
    'The café closes early in winter. #ideas\n\nChapter #1 is `#notatag` and [#notatag](x).\n',
  'Empty.md': '',
};
test.use({ vaultFiles: FILES });

const rows = (page: Page) => page.locator('.note-row');
const row = (page: Page, title: string) =>
  rows(page).filter({ has: page.locator('.note-row__title', { hasText: title }) });
const search = (page: Page) => page.getByRole('searchbox');
const heading = (page: Page) => page.locator('.list__heading');
/** A tag's row in the sidebar: "#name" and its count. */
const tagRow = (page: Page, name: string) =>
  page.locator('.tree-row__name').filter({ hasText: new RegExp(`^#${name}\\d+$`) });
const folderRow = (page: Page, name: string) =>
  page.locator('.tree-row__label', { hasText: new RegExp(`^${name}$`) });

test('each note shows a line of its words, without the marks', async ({ page }) => {
  await expect(row(page, 'The Tear').locator('.note-row__preview')).toHaveText(
    'The scarf catches on a nail.',
  );
  await expect(row(page, 'Empty').locator('.note-row__preview')).toHaveText('Empty');
  await expect(row(page, 'Empty').locator('.note-row__preview')).toHaveClass(/is-empty/);
});

test('a book’s chapters show their words instead of a date', async ({ page }) => {
  await folderRow(page, 'Fic').click();
  await folderRow(page, 'Scarf').click();
  // Counted as the page's colophon counts: the heading's words too, front matter not.
  await expect(page.locator('.note-row__meta')).toHaveText(['8 w', '9 w']);
  await page.locator('.note-row', { hasText: 'The Tear' }).click();
  await expect(page.locator('.colophon__words')).toHaveText('8 words');
});

test('tags from front matter and the text, nested, and never a number, code or a link', async ({
  page,
}) => {
  await expect(page.locator('.tree-row__hash')).toHaveCount(3); // draft, fic, ideas
  await expect(tagRow(page, 'fic')).toContainText('2');
  await page.getByRole('button', { name: 'Open #fic' }).click();
  await page.getByRole('button', { name: 'Open #fic/aot' }).click();
  await expect(page.locator('.tree-row__hash')).toHaveCount(5); // and aot, levi
  await expect(page.locator('.sidebar__tree')).not.toContainText('notatag');

  await tagRow(page, 'fic').click();
  await expect(heading(page)).toHaveText('#fic');
  await expect(page.locator('.list__head .label')).toHaveText('2 notes · Tag');
  await tagRow(page, 'levi').click();
  await expect(heading(page)).toHaveText('#fic/aot/levi');
  await expect(rows(page)).toHaveCount(1);
});

test('a tag typed in a note joins the sidebar once it’s saved', async ({ page }) => {
  await row(page, 'Ideas').click();
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' #snowfall');
  await expect(page.locator('.tree-row__label', { hasText: 'snowfall' })).toBeVisible({
    timeout: 5000,
  });
  await expect(row(page, 'Ideas').locator('.note-row__preview')).toContainText(
    'The café closes early',
  );
});

test('a tag written by another program appears, and goes when it’s taken out', async ({
  page,
  vault,
}) => {
  const file = join(vault ?? '', 'Empty.md');
  writeFileSync(file, 'Now with #elsewhere\n');
  await expect(page.locator('.tree-row__label', { hasText: 'elsewhere' })).toBeVisible({
    timeout: 5000,
  });
  await expect(row(page, 'Empty').locator('.note-row__preview')).toHaveText('Now with #elsewhere');
  writeFileSync(file, 'No tag now\n');
  await expect(page.locator('.tree-row__label', { hasText: 'elsewhere' })).toHaveCount(0, {
    timeout: 5000,
  });
});

test('search finds every word, accents aside, and clearing goes back to what was shown', async ({
  page,
}) => {
  await search(page).fill('cafe WINTER');
  await expect(heading(page)).toHaveText('“cafe WINTER”');
  await expect(rows(page)).toHaveCount(1);
  await expect(row(page, 'Ideas').locator('.note-row__preview')).toContainText(
    'café closes early in winter',
  );
  await expect(page.locator('.list__head .label')).toHaveText('1 note matches');

  await search(page).fill('scarf');
  await expect(rows(page).locator('.note-row__title')).toHaveText(['The Tear']);

  await search(page).press('Escape');
  await expect(search(page)).toHaveValue('');
  await expect(heading(page)).toHaveText('All Notes');
  await expect(rows(page)).toHaveCount(4);
});

test('search says when nothing matches, and Clear search comes back', async ({ page }) => {
  await search(page).fill('nothing like this');
  await expect(page.locator('.list__head .label')).toHaveText('No notes match');
  await page.locator('.list__empty').getByRole('button', { name: 'Clear search' }).click();
  await expect(search(page)).toHaveValue('');
  await expect(rows(page)).toHaveCount(4);
});

test('the last thing typed is what’s searched for', async ({ page }) => {
  await search(page).pressSequentially('scarf', { delay: 10 });
  await search(page).press('Backspace');
  await search(page).press('Backspace');
  await search(page).press('Backspace');
  await search(page).press('Backspace');
  await search(page).pressSequentially('ook', { delay: 10 }); // "sook" matches nothing; "s" + "ook"…
  await search(page).fill('Look');
  await expect(heading(page)).toHaveText('“Look”');
  await expect(rows(page).locator('.note-row__title')).toHaveText(['Seventeen']);
});

test('choosing a folder or tag clears the search', async ({ page }) => {
  await search(page).fill('scarf');
  await expect(rows(page)).toHaveCount(1);
  await page.locator('.tree-row__label', { hasText: 'All Notes' }).click();
  await expect(search(page)).toHaveValue('');
  await expect(heading(page)).toHaveText('All Notes');
});

test('Edit → Search Notes… puts the caret in the search field', async ({ app, page }) => {
  await expect(rows(page)).toHaveCount(4); // the vault is shown, and listening
  await clickMenu(app, 'Edit', 'Search Notes…');
  await expect(search(page)).toBeFocused();
});

test('the window can’t search with anything but text of a sensible length', async ({ page }) => {
  const outcomes = await page.evaluate(async () => {
    const find = window.eien.vault.search as (query: unknown) => Promise<unknown>;
    return Promise.all(
      [42, null, { q: 'x' }, 'x'.repeat(1001), 'ok'].map((query) =>
        find(query).then(
          () => 'answered',
          () => 'refused',
        ),
      ),
    );
  });
  expect(outcomes).toEqual(['refused', 'refused', 'refused', 'refused', 'answered']);
});

/**
 * Milliseconds until an element matching `selector` shows `text`, measured
 * in the page itself; from typing `query` into the search field, if given.
 */
function untilShown(page: Page, selector: string, text: string, query?: string): Promise<number> {
  return page.evaluate(
    ([selector, text, query]) =>
      new Promise<number>((done, fail) => {
        const started = performance.now();
        const shown = () =>
          [...document.querySelectorAll(selector)].some((el) => el.textContent?.includes(text));
        const watch = new MutationObserver(() => {
          if (!shown()) return;
          watch.disconnect();
          done(Math.round(performance.now() - started));
        });
        watch.observe(document.body, { subtree: true, childList: true, characterData: true });
        setTimeout(() => fail(new Error(`${text} never showed`)), 20_000);
        if (query !== undefined) {
          const field = document.querySelector<HTMLInputElement>('input[type="search"]');
          if (!field) return fail(new Error('no search field'));
          field.value = query;
          field.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (shown()) {
          watch.disconnect();
          done(0);
        }
      }),
    [selector, text, query] as const,
  );
}

test.describe('a vault of 5,000 notes', () => {
  test.use({ vaultFiles: null });
  test.setTimeout(120_000);

  test('opens, searches and saves within set times', TIMING, async ({ userData }) => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 5000; i++) {
      const folder = `Folder ${i % 50}`;
      const tag = i % 7 === 0 ? ' #seventh' : '';
      const rare = i === 4321 ? ' marmalade' : '';
      files[`${folder}/Note ${i}.md`] =
        `# Note ${i}\n\nA paragraph of a few words about the scarf, number ${i}.${tag}${rare}\n\n${'More words here. '.repeat(20)}\n`;
    }
    const vault = makeVault(files);
    const started = Date.now();
    const app = await launchApp(userData, vault);
    try {
      const page = await app.firstWindow();
      await expect(page.locator('.list__head .label')).toHaveText('5,000 notes', {
        timeout: 30_000,
      });
      const opened = Date.now() - started;
      console.log(`5,000 notes: listed ${opened} ms after launch`);
      expect(opened).toBeLessThan(20_000); // with Electron's start, on CI's slower machines
      await expect(page.locator('.tree-row__label', { hasText: 'seventh' })).toBeVisible();

      // Times are taken in the page, from the change to the moment the page shows it:
      // Playwright's own checks poll at growing intervals and would add up to a second.
      const searched = await untilShown(page, '.note-row__title', 'Note 4321', 'marmalade');
      console.log(`5,000 notes: one word found in ${searched} ms (150 ms of it the typing pause)`);
      expect(searched).toBeLessThan(2_000);

      await search(page).fill('scarf');
      await expect(page.locator('.list__head .label')).toHaveText(
        '5,000 notes match · the first 200',
      );

      await search(page).press('Escape');
      await row(page, 'Note 4321').click();
      await editorContent(page).click();
      await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.type(' #justsaved');
      const saved = await untilShown(page, '.tree-row__label', 'justsaved');
      console.log(
        `5,000 notes: a typed tag in the sidebar ${saved} ms after the last key (800 ms of it the autosave pause)`,
      );
      // Spec §11: within 5 s. Windows' runners have taken 2.3–4.8 s here on main, under the other tests' load.
      expect(saved).toBeLessThan(5_000);
    } finally {
      await closeApp(app);
    }
  });
});
