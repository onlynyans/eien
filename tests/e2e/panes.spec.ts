// Phase 6c on the real app: the panes resized by their edges, shut and
// opened (⌘\, ⌘⇧\, the page bar, the seal), given the keyboard (⌘1–3), and
// two panes, where the tree lists the notes (spec §4). Remembered on this
// device, across a restart.

import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Locator, Page } from '@playwright/test';
import { boxOf, clickMenu, closeApp, expect, fakeTrash, launchApp, test } from './launch';

const BOOK = 'Fic/Scarf';
test.use({
  vaultFiles: {
    [`${BOOK}/The Tear.md`]: 'The scarf catches.\n',
    [`${BOOK}/Needle.md`]: 'A sewing kit. #winter\n',
    [`${BOOK}/Seventeen.md`]: '"Look," he begins.\n',
    [`${BOOK}/.eien-folder.json`]: JSON.stringify({
      order: ['The Tear.md', 'Needle.md', 'Seventeen.md'],
      book: {},
    }),
    'Ideas.md': 'Snow on the walls. #winter\n',
    'Research/Wool.md': 'Knitted wool runs.\n',
  },
});

const width = async (locator: Locator) => (await locator.boundingBox())?.width ?? -1;
const sidebarWidth = (page: Page) => width(page.locator('.sidebar'));
const listWidth = (page: Page) => width(page.locator('.list'));
/** A design token's length, as the window computes it. */
const token = (page: Page, name: string) =>
  page.evaluate(
    (name) => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)),
    name,
  );
const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const folder = (page: Page, name: string) =>
  page
    .locator('.tree-row:not(.tree-row--note) .tree-row__name')
    .filter({ has: page.locator('.tree-row__label', { hasText: exactly(name) }) });
const treeNote = (page: Page, title: string) =>
  page
    .locator('.tree-row--note .tree-row__name')
    .filter({ has: page.locator('.tree-row__label', { hasText: exactly(title) }) });
const treeNotes = (page: Page) => page.locator('.tree-row--note .tree-row__label');
const row = (page: Page, title: string) =>
  page
    .locator('.note-row')
    .filter({ has: page.locator('.note-row__title', { hasText: exactly(title) }) });
const barButton = (page: Page, pane: 'sidebar' | 'list') =>
  page.locator(`.page__panes [data-pane="${pane}"]`);
/** Whether the keyboard is somewhere in `selector` (the editor's shadow root counts). */
const focusIn = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const active = document.activeElement;
    return (
      active !== null &&
      active !== document.body &&
      !!document.querySelector(selector)?.contains(active)
    );
  }, selector);
const read = (vault: string | null, path: string) =>
  readFileSync(join(vault ?? '', ...path.split('/')), 'utf8');

async function openBook(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open Fic' }).click();
  await folder(page, 'Scarf').click();
  await expect(page.locator('.note-row__title')).toHaveText(['The Tear', 'Needle', 'Seventeen']);
}

/** Drag a pane's edge `by` pixels, as a pointer would. */
async function dragEdge(page: Page, pane: 'sidebar' | 'list', by: number): Promise<void> {
  const edge = page.locator(`.pane-edge--${pane}`);
  const box = await boxOf(edge);
  const x = box.x + box.width / 2;
  await page.mouse.move(x, 300);
  await page.mouse.down();
  // The edge has the press before the pointer moves: on a busy machine the moves could come first.
  await expect(edge).toHaveClass(/is-dragging/);
  await page.mouse.move(x + by, 300, { steps: 6 });
  await page.mouse.up();
  await expect(edge).not.toHaveClass(/is-dragging/);
}

async function twoPanes(page: Page): Promise<void> {
  await page.getByRole('button', { name: '2 panes' }).click();
  await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
}

/**
 * Size the window's page `width` × `height`, once the app is up (its own first
 * sizing would undo an earlier one), and wait until it is that wide.
 */
async function setWindow(app: ElectronApplication, width: number, height: number): Promise<void> {
  const page = await app.firstWindow();
  await expect(page.locator('.shell')).toBeVisible();
  await app.evaluate(
    ({ BrowserWindow }, [width, height]) =>
      BrowserWindow.getAllWindows()[0]?.setContentSize(width, height),
    [width, height] as const,
  );
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(width);
}

test.describe('resizing', () => {
  test('the panes open at the design’s widths; two panes and a shut sidebar have their own', async ({
    page,
  }) => {
    await expect(page.locator('.note-row').first()).toBeVisible();
    const sidebar = await token(page, '--eien-sidebar-w');
    const strip = await token(page, '--eien-space-7');
    await expect.poll(() => sidebarWidth(page)).toBe(sidebar);
    await expect.poll(() => listWidth(page)).toBe(await token(page, '--eien-list-w'));
    await twoPanes(page);
    await expect.poll(() => sidebarWidth(page)).toBe(sidebar + strip);
    await expect(page.locator('.list')).toBeHidden();
    await page.locator('.sidebar__hide').click();
    await expect.poll(() => sidebarWidth(page)).toBe(strip);
  });

  test('an edge, dragged or stepped with ← →, resizes its pane within limits; a restart keeps it', async ({
    app,
    page,
    userData,
    vault,
  }) => {
    // Wide enough to show both at their widest: a runner's screen may be narrower.
    await expect(page.locator('.note-row').first()).toBeVisible();
    await setWindow(app, 1400, 800);
    await expect.poll(() => listWidth(page)).toBe(await token(page, '--eien-list-w'));
    const step = await token(page, '--eien-space-4');
    const list = await listWidth(page);
    await dragEdge(page, 'sidebar', 60);
    await expect.poll(() => sidebarWidth(page)).toBe((await token(page, '--eien-sidebar-w')) + 60);
    await dragEdge(page, 'sidebar', -1000); // past its narrowest
    await expect.poll(() => sidebarWidth(page)).toBe(200);
    await expect(page.locator('.pane-edge--sidebar')).toHaveAttribute('aria-valuenow', '200');

    const edge = page.locator('.pane-edge--list');
    await edge.focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => listWidth(page)).toBe(list + 2 * step);
    await expect(edge).toHaveAttribute('aria-valuenow', String(list + 2 * step));
    for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight'); // past its widest
    await expect(edge).toHaveAttribute('aria-valuenow', '480');

    await closeApp(app);
    const again = await launchApp(userData, vault);
    try {
      const page2 = await again.firstWindow();
      await expect(page2.locator('.note-row').first()).toBeVisible();
      await setWindow(again, 1400, 800);
      await expect.poll(() => sidebarWidth(page2)).toBe(200);
      await expect.poll(() => listWidth(page2)).toBe(480);
    } finally {
      await closeApp(again);
    }
  });

  test('a narrow window gives the list, then the sidebar, way; a wide one gives them back', async ({
    app,
    page,
  }) => {
    await expect(page.locator('.note-row').first()).toBeVisible();
    const sidebar = await sidebarWidth(page);
    const list = await listWidth(page);
    await setWindow(app, 700, 600);
    // 264 + 316 + a page of 360 won't fit in 700: the list goes to its narrowest, then the sidebar.
    await expect.poll(() => listWidth(page)).toBe(260);
    await expect.poll(() => sidebarWidth(page)).toBe(200);
    await setWindow(app, 1280, 800);
    await expect.poll(() => listWidth(page)).toBe(list);
    await expect.poll(() => sidebarWidth(page)).toBe(sidebar);
  });
});

test.describe('shutting and opening', () => {
  test('the View menu has the keys: ⌘\\, ⌘⇧\\ and ⌘1–3', async ({ app, page }) => {
    await expect(page.locator('.note-row').first()).toBeVisible(); // the app's own menu is up
    const items = await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()
        ?.items.find((item) => item.label === 'View')
        ?.submenu?.items.map((item) => [item.label, item.accelerator ?? null]),
    );
    expect(items).toEqual(
      expect.arrayContaining([
        ['Toggle Sidebar', 'CmdOrCtrl+\\'],
        ['Toggle Note List', 'CmdOrCtrl+Shift+\\'],
        ['Go to Sidebar', 'CmdOrCtrl+1'],
        ['Go to Note List', 'CmdOrCtrl+2'],
        ['Go to Page', 'CmdOrCtrl+3'],
      ]),
    );
  });

  test('the menu, the page bar’s words and the seal shut and open the sidebar and the list', async ({
    app,
    page,
  }) => {
    await expect(page.locator('.note-row').first()).toBeVisible();
    const search = page.getByRole('searchbox');
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await expect(page.locator('.sidebar__show')).toBeVisible();
    await expect(search).toBeHidden();
    await expect(barButton(page, 'sidebar')).toHaveText('Show Sidebar');
    await barButton(page, 'sidebar').click();
    await expect(search).toBeVisible();
    await expect(barButton(page, 'sidebar')).toHaveText('Hide Sidebar');
    await page.locator('.sidebar__hide').click();
    await expect(search).toBeHidden();
    await page.locator('.sidebar__show').click();
    await expect(search).toBeVisible();

    await clickMenu(app, 'View', 'Toggle Note List');
    await expect(page.locator('.list')).toBeHidden();
    await expect(page.locator('.pane-edge--list')).toBeHidden();
    await expect(barButton(page, 'list')).toHaveText('Show List');
    await barButton(page, 'list').click();
    await expect(page.locator('.list')).toBeVisible();
    await expect(barButton(page, 'list')).toHaveText('Hide List');
  });

  test('a pane shut with the keyboard in it gives the keyboard to the page', async ({
    app,
    page,
  }) => {
    await row(page, 'Ideas').click();
    await row(page, 'Ideas').focus();
    await clickMenu(app, 'View', 'Toggle Note List');
    await expect.poll(() => focusIn(page, '.page')).toBe(true);
    await clickMenu(app, 'View', 'Toggle Note List');
    await page.getByRole('searchbox').focus();
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await expect.poll(() => focusIn(page, '.page')).toBe(true);
  });

  test('with the sidebar and the list both shut, the news shows in the page’s status line', async ({
    app,
    page,
  }) => {
    await openBook(page);
    await row(page, 'Needle').click();
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await clickMenu(app, 'View', 'Toggle Note List');
    await page.locator('.title').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Seventeen'); // taken: the rename is refused, and says why
    await page.keyboard.press('Enter');
    await expect(page.locator('.colophon__news')).toHaveText(
      'Something here already has that name.',
    );
    await barButton(page, 'list').click(); // a pane to show it again: it moves there
    await expect(page.locator('.list__notice')).toHaveText('Something here already has that name.');
    await expect(page.locator('.colophon__news')).toBeHidden();
  });

  test('⌘1, ⌘2 and ⌘3 give the sidebar, the list and the page the keyboard, opening a shut one', async ({
    app,
    page,
  }) => {
    await openBook(page);
    await row(page, 'Needle').click();
    const chosen = page.locator('.tree-row__name[aria-current="true"]');
    const open = page.locator('.note-row[aria-current="true"]');
    await clickMenu(app, 'View', 'Go to Sidebar');
    await expect(chosen).toBeFocused();
    await expect(chosen).toHaveText(/Scarf/);
    await clickMenu(app, 'View', 'Go to Note List');
    await expect(open).toBeFocused();
    await clickMenu(app, 'View', 'Go to Page');
    await expect.poll(() => focusIn(page, '.page')).toBe(true);

    await clickMenu(app, 'View', 'Toggle Sidebar');
    await clickMenu(app, 'View', 'Go to Sidebar');
    await expect(page.locator('.sidebar__show')).toBeHidden();
    await expect(chosen).toBeFocused();
    await clickMenu(app, 'View', 'Toggle Note List');
    await clickMenu(app, 'View', 'Go to Note List');
    await expect(page.locator('.list')).toBeVisible();
    await expect(open).toBeFocused();
  });
});

test.describe('two panes', () => {
  test('the tree lists the notes, a book’s in order and numbered, and opens them; a restart keeps two', async ({
    app,
    page,
    userData,
    vault,
  }) => {
    await expect(page.locator('.note-row').first()).toBeVisible();
    await twoPanes(page);
    await expect(page.locator('.list')).toBeHidden();
    await expect(page.locator('.pane-edge--list')).toBeHidden();
    await expect(barButton(page, 'list')).toBeDisabled();
    await expect(treeNotes(page)).toHaveText(['Ideas']); // the vault's own, after its folders

    await folder(page, 'Fic').click();
    await folder(page, 'Scarf').click();
    await expect(treeNotes(page)).toHaveText(['The Tear', 'Needle', 'Seventeen', 'Ideas']);
    await expect(page.locator('.tree-row__ord')).toHaveText(['i', 'ii', 'iii']);
    await folder(page, 'Scarf').click(); // chosen again: shut
    await expect(treeNotes(page)).toHaveText(['Ideas']);
    await folder(page, 'Scarf').click();

    await treeNote(page, 'Needle').click();
    await expect(page.locator('.title')).toHaveText('Needle');
    await expect(treeNote(page, 'Needle')).toHaveAttribute('aria-current', 'true');

    await folder(page, 'All Notes').click();
    await expect(treeNotes(page)).toHaveCount(5 + 4);
    await folder(page, 'All Notes').click();
    await folder(page, '#winter').click();
    await expect(treeNotes(page)).toHaveText([
      'The Tear',
      'Needle',
      'Seventeen',
      'Ideas',
      /./,
      /./,
    ]);

    // No list to go to: ⌘2 is the page, and ⌘⇧\ does nothing.
    await clickMenu(app, 'View', 'Go to Note List');
    await expect.poll(() => focusIn(page, '.page')).toBe(true);
    await clickMenu(app, 'View', 'Toggle Note List');
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
    await expect(page.locator('.list')).toBeHidden();

    await expect
      .poll(() => JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8')))
      .toEqual({ settings: { 'layout.panes': 'two' } });
    await closeApp(app);
    const again = await launchApp(userData, vault);
    try {
      const page2 = await again.firstWindow();
      await expect(page2.locator('.shell')).toHaveAttribute('data-panes', 'two');
      await expect(page2.locator('.list')).toBeHidden();
      await expect(treeNotes(page2)).toHaveText(['Ideas']);
    } finally {
      await closeApp(again);
    }
  });

  test('with no list in sight, a search shows its results in the tree; Clear gives the tree back', async ({
    app,
    page,
  }) => {
    await expect(page.locator('.note-row').first()).toBeVisible();
    await twoPanes(page);
    const search = page.getByRole('searchbox');
    await search.fill('sewing');
    await expect(page.locator('.sidebar__label')).toHaveText(['Results']);
    await expect(treeNotes(page)).toHaveText(['Needle']);
    await treeNote(page, 'Needle').click();
    await expect(page.locator('.title')).toHaveText('Needle');
    await search.fill('zzzz');
    await expect(page.locator('.sidebar__empty')).toContainText('No notes match.');
    await page.locator('.sidebar__empty').getByRole('button', { name: 'Clear search' }).click();
    await expect(page.locator('.sidebar__label')).toHaveText(['Library', 'Folders', 'Tags']);

    // Three panes, the list shut: the tree shows them; the list opened, they go back to it.
    await page.getByRole('button', { name: '3 panes' }).click();
    await clickMenu(app, 'View', 'Toggle Note List');
    await search.fill('wool');
    await expect(treeNotes(page)).toHaveText(['Wool']);
    await barButton(page, 'list').click();
    await expect(page.locator('.note-row__title')).toHaveText(['Wool']);
    await expect(page.locator('.sidebar__label')).toHaveText(['Library', 'Folders', 'Tags']);
  });

  test('the tree’s notes have the list’s menu, keys and drags; news shows at the sidebar’s foot', async ({
    app,
    page,
    vault,
  }) => {
    const trash = await fakeTrash(app);
    try {
      await expect(page.locator('.note-row').first()).toBeVisible();
      await twoPanes(page);
      await treeNote(page, 'Ideas').click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Pin' }).click();
      await expect(folder(page, 'Pinned')).toBeVisible();
      await expect.poll(() => read(vault, '.eien/pinned.json')).toContain('Ideas.md');

      await folder(page, 'Fic').click();
      await folder(page, 'Scarf').click();
      await treeNote(page, 'Seventeen').focus();
      await page.keyboard.press('F2');
      await expect(page.locator('.title__field')).toBeFocused();
      await page.keyboard.type('Eighteen');
      await page.keyboard.press('Enter');
      await expect(page.locator('.tree-row__ord')).toHaveText(['i', 'ii', 'iii']);
      await expect(treeNotes(page)).toHaveText(['The Tear', 'Needle', 'Eighteen', 'Ideas']);

      // Alt+↓ on a chapter in the tree moves it down the book's order.
      await treeNote(page, 'The Tear').focus();
      await page.keyboard.press('Alt+ArrowDown');
      await expect(treeNotes(page)).toHaveText(['Needle', 'The Tear', 'Eighteen', 'Ideas']);

      // Dragged onto a folder, a note moves into it.
      const from = await boxOf(treeNote(page, 'Ideas'));
      const to = await boxOf(folder(page, 'Research'));
      await page.mouse.move(from.x + 30, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + 30, from.y + from.height / 2 + 12, { steps: 3 });
      await page.mouse.move(to.x + 30, to.y + to.height / 2, { steps: 6 });
      await page.mouse.up();
      await expect.poll(() => existsSync(join(vault ?? '', 'Research', 'Ideas.md'))).toBe(true);

      await folder(page, 'Research').click();
      await treeNote(page, 'Wool').focus();
      await page.keyboard.press(
        process.platform === 'darwin' ? 'Meta+Backspace' : 'Control+Delete',
      );
      await expect(page.locator('.sidebar__notice')).toContainText('“Wool” is in the');
      await expect.poll(() => readdirSync(trash)).toEqual(['Wool.md']);
    } finally {
      rmSync(trash, { recursive: true, force: true });
    }
  });
});
