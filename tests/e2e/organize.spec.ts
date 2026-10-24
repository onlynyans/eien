// Phase 6b on the real app: renaming, moving, ordering, books, pins and the
// trash — by drag, by menu and by key — with the open note, the folder's
// order and the pins kept in step (spec §2–§4).

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import {
  ALONE,
  closeApp,
  editorContent,
  expect,
  fakeTrash,
  launchApp,
  readQuietly,
  test,
} from './launch';

const BOOK = 'Fic/Scarf';
test.use({
  vaultFiles: {
    [`${BOOK}/The Tear.md`]: 'The scarf catches.\n',
    [`${BOOK}/Seventeen.md`]: '"Look," he begins.\n',
    [`${BOOK}/Needle.md`]: 'A sewing kit.\n',
    [`${BOOK}/.eien-folder.json`]: JSON.stringify({
      order: ['The Tear.md', 'Needle.md', 'Seventeen.md'],
      book: {},
    }),
    'Ideas.md': 'Snow on the walls.\n',
    'Research/Wool.md': 'Knitted wool runs.\n',
  },
});

const at = (vault: string | null, path: string) => join(vault ?? '', ...path.split('/'));
/** '' while the file can't be read, so a poll tries again (./launch.ts). */
const read = (vault: string | null, path: string) => readQuietly(at(vault, path));
const order = (vault: string | null) =>
  (JSON.parse(read(vault, `${BOOK}/.eien-folder.json`)) as { order: string[] }).order;
const row = (page: Page, title: string) =>
  page
    .locator('.note-row')
    .filter({ has: page.locator('.note-row__title', { hasText: new RegExp(`^${title}$`) }) });
const folder = (page: Page, name: string) =>
  page
    .locator('.tree-row__name')
    .filter({ has: page.locator('.tree-row__label', { hasText: new RegExp(`^${name}$`) }) });
const menuItem = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true });

async function openBook(page: Page): Promise<void> {
  await folder(page, 'Fic').click();
  await folder(page, 'Scarf').click();
  await expect(page.locator('.note-row__title')).toHaveText(['The Tear', 'Needle', 'Seventeen']);
}

/** Drag the row titled `title` and drop it at the point of `target` (its top or bottom half). */
async function drag(
  page: Page,
  title: string,
  target: ReturnType<Page['locator']>,
  half: 'top' | 'bottom' = 'top',
) {
  const from = await row(page, title).boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('nothing to drag');
  await page.mouse.move(from.x + 30, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + from.height / 2 + 12, { steps: 3 });
  await page.mouse.move(to.x + 30, to.y + (half === 'top' ? 4 : to.height - 4), { steps: 6 });
  await page.mouse.up();
}

test.describe('renaming', () => {
  test('the title renames the note, and its order, pin and later typing follow', async ({
    page,
    vault,
  }) => {
    await openBook(page);
    await row(page, 'Needle').click({ button: 'right' });
    await menuItem(page, 'Pin').click();
    // Pinned is always there: its count says the pin is in.
    await expect(page.locator('.tree-row__name[data-key="pinned"] .count')).toHaveText('1');
    await row(page, 'Needle').click();
    await page.locator('.title').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Needle and Thread');
    await page.keyboard.press('Enter');
    await expect(page.locator('.title')).toHaveText('Needle and Thread');
    await expect.poll(() => existsSync(at(vault, `${BOOK}/Needle and Thread.md`))).toBe(true);
    expect(existsSync(at(vault, `${BOOK}/Needle.md`))).toBe(false);
    await expect
      .poll(() => order(vault))
      .toEqual(['The Tear.md', 'Needle and Thread.md', 'Seventeen.md']);
    await expect
      .poll(() => JSON.parse(read(vault, '.eien/pinned.json') || '{}'))
      .toEqual([`${BOOK}/Needle and Thread.md`]);
    await expect(page.locator('.note-row__ord')).toHaveText(['i', 'ii', 'iii']);

    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' Bone needles.');
    await expect
      .poll(() => read(vault, `${BOOK}/Needle and Thread.md`), { timeout: 5000 })
      .toContain('Bone needles.');
    expect(existsSync(at(vault, `${BOOK}/Needle.md`))).toBe(false); // never written back under the old name
  });

  test('a name that’s taken is refused, and nothing moves', async ({ page, vault }) => {
    await openBook(page);
    await row(page, 'Seventeen').click();
    await page.locator('.title').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('the tear'); // another note's name, case aside
    await page.keyboard.press('Enter');
    await expect(page.locator('.list__notice')).toHaveText('Something here already has that name.');
    await expect(page.locator('.title')).toHaveText('Seventeen');
    expect(read(vault, `${BOOK}/Seventeen.md`)).toBe('"Look," he begins.\n');
    expect(read(vault, `${BOOK}/The Tear.md`)).toBe('The scarf catches.\n');
  });

  test('a change of case alone, characters no system allows, and Esc', async ({ page, vault }) => {
    await row(page, 'Ideas').click();
    await page.locator('.title').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('IDEAS');
    await page.keyboard.press('Enter');
    await expect(page.locator('.title')).toHaveText('IDEAS');
    await expect
      .poll(() => readdirSync(at(vault, '')).filter((name) => name.endsWith('.md')))
      .toEqual(['IDEAS.md']);

    await page.locator('.title').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('What now? A/B');
    await page.keyboard.press('Enter');
    await expect(page.locator('.title')).toHaveText('What now A B');

    await page.locator('.title').click();
    await page.keyboard.type(' — never');
    await page.keyboard.press('Escape');
    await expect(page.locator('.title')).toHaveText('What now A B');
    expect(existsSync(at(vault, 'What now A B.md'))).toBe(true);
  });

  test('F2 on a row renames it; a folder renames in place, and the selection follows', async ({
    page,
    vault,
  }) => {
    await row(page, 'Ideas').focus();
    await page.keyboard.press('F2');
    await expect(page.locator('.name-field__input')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(row(page, 'Ideas')).toBeFocused();

    await folder(page, 'Research').click();
    await folder(page, 'Research').press('F2');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Reading');
    await page.keyboard.press('Enter');
    await expect(folder(page, 'Reading')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.list__heading')).toHaveText('Reading');
    expect(read(vault, 'Reading/Wool.md')).toBe('Knitted wool runs.\n');
    expect(existsSync(at(vault, 'Research'))).toBe(false);
  });
});

test.describe('moving and ordering', () => {
  test(
    'dragging a note onto a folder moves it, and the open note carries on there',
    ALONE,
    async ({ page, vault }) => {
      await row(page, 'Ideas').click();
      await drag(page, 'Ideas', folder(page, 'Research'));
      await expect.poll(() => existsSync(at(vault, 'Research/Ideas.md'))).toBe(true);
      expect(existsSync(at(vault, 'Ideas.md'))).toBe(false);
      await expect(page.locator('.crumbs')).toHaveText('Research');
      await editorContent(page).click();
      await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.type(' And wind.');
      await expect
        .poll(() => read(vault, 'Research/Ideas.md'), { timeout: 5000 })
        .toContain('And wind.');
      expect(existsSync(at(vault, 'Ideas.md'))).toBe(false);
    },
  );

  test(
    'a note dropped where its name is taken keeps both, numbered',
    ALONE,
    async ({ page, vault }) => {
      writeFileSync(at(vault, 'Research/Ideas.md'), 'Already here.\n');
      await folder(page, 'Research').click();
      await expect(row(page, 'Ideas')).toBeVisible();
      await page.locator('.tree-row__label', { hasText: /^All Notes$/ }).click();
      await expect(page.locator('.note-row__title', { hasText: /^Ideas$/ })).toHaveCount(2);
      // The one at the top of the vault, by its words.
      const top = page.locator('.note-row', { hasText: 'Snow on the walls.' });
      const from = await top.boundingBox();
      const to = await folder(page, 'Research').boundingBox();
      if (!from || !to) throw new Error('nothing to drag');
      await page.mouse.move(from.x + 30, from.y + 10);
      await page.mouse.down();
      await page.mouse.move(to.x + 30, to.y + 10, { steps: 6 });
      await page.mouse.up();
      await expect.poll(() => existsSync(at(vault, 'Research/Ideas 2.md'))).toBe(true);
      expect(read(vault, 'Research/Ideas 2.md')).toBe('Snow on the walls.\n');
      expect(read(vault, 'Research/Ideas.md')).toBe('Already here.\n');
      expect(existsSync(at(vault, 'Ideas.md'))).toBe(false);
    },
  );

  test(
    'dragging between a book’s chapters puts them in order; Alt+↓ and the menu too',
    ALONE,
    async ({ page, vault }) => {
      await openBook(page);
      await drag(page, 'Seventeen', row(page, 'The Tear'), 'top');
      await expect(page.locator('.note-row__title')).toHaveText([
        'Seventeen',
        'The Tear',
        'Needle',
      ]);
      await expect.poll(() => order(vault)).toEqual(['Seventeen.md', 'The Tear.md', 'Needle.md']);

      await row(page, 'Seventeen').focus();
      await page.keyboard.press('Alt+ArrowDown');
      await expect(page.locator('.note-row__title')).toHaveText([
        'The Tear',
        'Seventeen',
        'Needle',
      ]);

      await row(page, 'Needle').click({ button: 'right' });
      await menuItem(page, 'Move up').click();
      await expect(page.locator('.note-row__title')).toHaveText([
        'The Tear',
        'Needle',
        'Seventeen',
      ]);
      await expect.poll(() => order(vault)).toEqual(['The Tear.md', 'Needle.md', 'Seventeen.md']);
    },
  );

  test('Esc during a drag puts the note back', ALONE, async ({ page, vault }) => {
    await openBook(page);
    const from = await row(page, 'Seventeen').boundingBox();
    const to = await folder(page, 'Research').boundingBox();
    if (!from || !to) throw new Error('nothing to drag');
    await page.mouse.move(from.x + 30, from.y + 10);
    await page.mouse.down();
    await page.mouse.move(to.x + 30, to.y + 10, { steps: 6 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(existsSync(at(vault, `${BOOK}/Seventeen.md`))).toBe(true);
    await expect(page.locator('.note-row.is-lifted')).toHaveCount(0);
  });

  test('Move to… from the keyboard: the menu key, then the folder', async ({ page, vault }) => {
    await row(page, 'Ideas').focus();
    await page.keyboard.press('Shift+F10');
    await menuItem(page, 'Move to…').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await menuItem(page, 'Scarf').click();
    await expect.poll(() => existsSync(at(vault, `${BOOK}/Ideas.md`))).toBe(true);
    await expect // written just after the move: last in the book
      .poll(() => order(vault))
      .toEqual(['The Tear.md', 'Needle.md', 'Seventeen.md', 'Ideas.md']);
  });

  test('a folder can’t be moved inside itself, or where it is', async ({ page }) => {
    await folder(page, 'Fic').click(); // open it, so Scarf is in the tree
    await folder(page, 'Fic').click({ button: 'right' });
    await menuItem(page, 'Move to…').click();
    const names = await page.getByRole('menuitem').allTextContents();
    expect(names).toHaveLength(2); // the vault itself, and Research: never Fic or Scarf
    expect(names[1]).toBe('Research');
    await expect(page.getByRole('menuitem').first()).toBeDisabled(); // it's there already
  });

  test('sorting by title, remembered on this device', async ({ app, page, userData, vault }) => {
    await openBook(page);
    await page.locator('.list').hover();
    await page.locator('.list__sort').click();
    await page.getByRole('menuitemradio', { name: 'Title' }).click();
    await expect(page.locator('.note-row__title')).toHaveText(['Needle', 'Seventeen', 'The Tear']);
    await expect(page.locator('.note-row__ord')).toHaveText(['ii', 'iii', 'i']); // the book's own numbers
    await closeApp(app);
    const again = await launchApp(userData, vault);
    try {
      const page2 = await again.firstWindow();
      await openBook(page2).catch(() => undefined);
      await expect(page2.locator('.note-row__title')).toHaveText([
        'Needle',
        'Seventeen',
        'The Tear',
      ]);
    } finally {
      await closeApp(again);
    }
  });
});

test.describe('books, folders and pins', () => {
  test('a folder made a book, and back', async ({ page, vault }) => {
    await folder(page, 'Research').click({ button: 'right' });
    await menuItem(page, 'Make it a book').click();
    await folder(page, 'Research').click();
    await expect(page.locator('.list__count')).toHaveText('1 note · Book');
    await expect
      .poll(() => JSON.parse(read(vault, 'Research/.eien-folder.json') || '{}'))
      .toEqual({ book: {} });
    await folder(page, 'Research').click({ button: 'right' });
    await menuItem(page, 'Not a book').click();
    await expect(page.locator('.list__count')).toHaveText('1 note');
  });

  test('a new folder, named in place', async ({ page, vault }) => {
    await page.locator('.sidebar').hover();
    await page.getByRole('button', { name: 'New folder' }).click();
    await expect(page.locator('.tree-row__field')).toBeFocused();
    await page.keyboard.type('Drafts');
    await page.keyboard.press('Enter');
    await expect(folder(page, 'Drafts')).toBeVisible();
    await expect.poll(() => existsSync(at(vault, 'Drafts'))).toBe(true);
    expect(existsSync(at(vault, 'New folder'))).toBe(false);
  });

  test('pinned notes have their own list, in the order pinned', async ({ page, vault }) => {
    for (const title of ['Ideas']) {
      await row(page, title).click({ button: 'right' });
      await menuItem(page, 'Pin').click();
    }
    await openBook(page);
    await row(page, 'Seventeen').click({ button: 'right' });
    await menuItem(page, 'Pin').click();
    await page.locator('.tree-row__label', { hasText: /^Pinned$/ }).click();
    await expect(page.locator('.note-row__title')).toHaveText(['Ideas', 'Seventeen']);
    await row(page, 'Ideas').click({ button: 'right' });
    await menuItem(page, 'Unpin').click();
    await expect(page.locator('.note-row__title')).toHaveText(['Seventeen']);
    await expect
      .poll(() => JSON.parse(read(vault, '.eien/pinned.json') || '{}'))
      .toEqual([`${BOOK}/Seventeen.md`]);
  });
});

test.describe('the trash', () => {
  test('a note goes to the system’s trash, open or not, and the writer is told', async ({
    app,
    page,
    vault,
  }) => {
    const trash = await fakeTrash(app);
    try {
      await row(page, 'Ideas').click();
      await editorContent(page).click();
      await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.type(' Last words.');
      await row(page, 'Ideas').click({ button: 'right' });
      await menuItem(
        page,
        process.platform === 'win32' ? 'Move to the Recycle Bin' : 'Move to the trash',
      ).click();
      await expect(page.locator('.list__notice')).toContainText('“Ideas” is in the');
      await expect(page.locator('.page__empty')).toBeVisible();
      expect(existsSync(at(vault, 'Ideas.md'))).toBe(false);
      expect(readFileSync(join(trash, 'Ideas.md'), 'utf8')).toContain('Last words.'); // saved first
      await page.waitForTimeout(1200);
      expect(existsSync(at(vault, 'Ideas.md'))).toBe(false); // and no save puts it back
    } finally {
      rmSync(trash, { recursive: true, force: true });
    }
  });

  test('⌘⌫ (Ctrl+Delete) on a row, and a folder with its notes and order', async ({
    app,
    page,
    vault,
  }) => {
    const trash = await fakeTrash(app);
    try {
      await row(page, 'Ideas').focus();
      await page.keyboard.press(
        process.platform === 'darwin' ? 'Meta+Backspace' : 'Control+Delete',
      );
      await expect.poll(() => existsSync(at(vault, 'Ideas.md'))).toBe(false);
      await folder(page, 'Fic').click();
      await folder(page, 'Fic').click({ button: 'right' });
      await menuItem(
        page,
        process.platform === 'win32' ? 'Move to the Recycle Bin' : 'Move to the trash',
      ).click();
      await expect.poll(() => readdirSync(trash).sort()).toEqual(['Fic', 'Ideas.md']);
      await expect(page.locator('.list__heading')).toHaveText('All Notes'); // the folder shown is gone
    } finally {
      rmSync(trash, { recursive: true, force: true });
    }
  });

  test('when the trash fails, nothing is deleted, and the writer is told', async ({
    app,
    page,
    vault,
  }) => {
    const trash = await fakeTrash(app, { works: false });
    try {
      await row(page, 'Ideas').click({ button: 'right' });
      await menuItem(
        page,
        process.platform === 'win32' ? 'Move to the Recycle Bin' : 'Move to the trash',
      ).click();
      await expect(page.locator('.list__notice')).toContainText('couldn’t go to');
      await expect(page.locator('.list__notice')).toContainText('nothing was deleted');
      expect(read(vault, 'Ideas.md')).toBe('Snow on the walls.\n');
      await expect(row(page, 'Ideas')).toBeVisible();
    } finally {
      rmSync(trash, { recursive: true, force: true });
    }
  });
});
