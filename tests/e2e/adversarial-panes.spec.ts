// Adversarial: phase 6c on the real app — where the keyboard goes when a
// pane shuts, a row is redrawn away or a control replaced; what a narrow
// window does to the widths remembered; two panes' tree under drags,
// look-alike names and many notes; hostile stored state.

import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Locator, Page } from '@playwright/test';
import {
  ALONE,
  boxOf,
  clickMenu,
  closeApp,
  editorContent,
  expect,
  fakeTrash,
  launchApp,
  test,
  type VaultFiles,
} from './launch';

const FILES: VaultFiles = {
  'Fic/Scarf/The Tear.md': 'The scarf catches.\n',
  'Fic/Scarf/Needle.md': 'A sewing kit. #winter\n',
  'Fic/Scarf/Seventeen.md': '"Look," he begins.\n',
  'Fic/Scarf/.eien-folder.json': JSON.stringify({
    order: ['The Tear.md', 'Needle.md', 'Seventeen.md'],
    book: {},
  }),
  'Ideas.md': 'Snow on the walls. #winter\n',
  'Research/Wool.md': 'Knitted wool runs.\n',
};
test.use({ vaultFiles: FILES });

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
const width = async (locator: Locator) => (await locator.boundingBox())?.width ?? -1;
const listWidth = (page: Page) => width(page.locator('.list'));
const sidebarWidth = (page: Page) => width(page.locator('.sidebar'));
const at = (vault: string | null, path: string) => join(vault ?? '', ...path.split('/'));
const folders = (vault: string | null) =>
  readdirSync(at(vault, ''), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
const trashKey = process.platform === 'darwin' ? 'Meta+Backspace' : 'Control+Delete';

/** Where the keyboard is: a short description of the focused element, or "body" for nowhere. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return 'body';
    const label = active.getAttribute('aria-label') ?? active.textContent?.trim().slice(0, 40);
    return `${active.tagName.toLowerCase()}.${active.className}: ${label}`;
  });
/**
 * Whether the keyboard is somewhere in `selector` (the editor's shadow root counts), on
 * something the writer can see: a control hidden while it had focus may keep it, unseen.
 */
const focusIn = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const active = document.activeElement;
    return (
      active !== null &&
      active !== document.body &&
      active.checkVisibility() &&
      !!document.querySelector(selector)?.contains(active)
    );
  }, selector);

const setWindow = (app: ElectronApplication, width: number, height: number) =>
  app.evaluate(
    ({ BrowserWindow }, [width, height]) =>
      BrowserWindow.getAllWindows()[0]?.setContentSize(width, height),
    [width, height] as const,
  );

async function ready(page: Page): Promise<void> {
  await expect(page.locator('.note-row').first()).toBeVisible();
}

async function twoPanes(page: Page): Promise<void> {
  // By a selector the window answers itself: a role locator works out the name of every control,
  // thousands of rows among them, in the window, and would be a long task measured below.
  await page.locator('.sidebar__foot [data-command="panes"][aria-pressed="false"]').click();
  await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
}

test.describe('the keyboard is never lost', () => {
  test('a note trashed from the tree (two panes) leaves the keyboard on the row in its place', async ({
    app,
    page,
  }) => {
    // The note list gives the keyboard to the next row; the tree drops it, so the next ⌘⌫ does nothing.
    const trash = await fakeTrash(app);
    try {
      await ready(page);
      await twoPanes(page);
      await folder(page, 'Fic').click();
      await folder(page, 'Scarf').click();
      await treeNote(page, 'Needle').focus();
      await page.keyboard.press(trashKey);
      await expect.poll(() => readdirSync(trash)).toEqual(['Needle.md']);
      await expect(treeNotes(page)).toHaveText(['The Tear', 'Seventeen', 'Ideas']);
      await expect.poll(() => focusIn(page, '.sidebar__tree')).toBe(true);
    } finally {
      rmSync(trash, { recursive: true, force: true });
    }
  });

  test('the strip’s seal, pressed from the keyboard, opens the sidebar and keeps the keyboard in it', async ({
    app,
    page,
  }) => {
    // The seal pressed is hidden as the sidebar opens, and the keyboard goes with it to nowhere.
    await ready(page);
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await page.locator('.sidebar__show').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.sidebar__vault')).toBeVisible();
    await expect.poll(() => focused(page)).not.toBe('body');
    await expect.poll(() => focusIn(page, '.sidebar')).toBe(true);
  });

  test('a pane shut while the keyboard is on its edge gives the keyboard to the page', async ({
    app,
    page,
  }) => {
    // A keyboard user widening the sidebar with ← → then pressing ⌘\ is left nowhere.
    await row(page, 'Ideas').click();
    await page.locator('.pane-edge--sidebar').focus();
    await page.keyboard.press('ArrowRight');
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await expect(page.locator('.sidebar__show')).toBeVisible();
    await expect.poll(() => focusIn(page, '.page')).toBe(true);
  });

  test('with no note open, a pane shut with the keyboard in it still gives it to the page', async ({
    app,
    page,
  }) => {
    // page.focus() is the editor's, which is hidden until a note opens: the keyboard goes nowhere.
    await ready(page);
    await row(page, 'Ideas').focus();
    await clickMenu(app, 'View', 'Toggle Note List');
    await expect(page.locator('.list')).toBeHidden();
    await expect.poll(() => focused(page)).not.toBe('body');
    await expect.poll(() => focusIn(page, '.page')).toBe(true);
  });

  test('⌘3 with no note open gives the page the keyboard', async ({ app, page }) => {
    await ready(page);
    await page.getByRole('searchbox').focus();
    await clickMenu(app, 'View', 'Go to Page');
    await expect.poll(() => focusIn(page, '.page')).toBe(true);
  });

  test('⌘2 opens a list shut since the last launch, with the keyboard on its rows', async ({
    app,
    page,
    userData,
    vault,
  }) => {
    // The list shut at launch was never drawn, so ⌘2 finds nothing in it to focus.
    await ready(page);
    await clickMenu(app, 'View', 'Toggle Note List');
    await expect(page.locator('.list')).toBeHidden();
    await closeApp(app);
    const again = await launchApp(userData, vault);
    try {
      const page2 = await again.firstWindow();
      await expect(page2.locator('.tree-row__name').first()).toBeVisible();
      await expect(page2.locator('.list')).toBeHidden();
      await clickMenu(again, 'View', 'Go to Note List');
      await expect(page2.locator('.note-row').first()).toBeVisible();
      await expect.poll(() => focusIn(page2, '.list')).toBe(true);
    } finally {
      await closeApp(again);
    }
  });

  test('⌘1 with two panes and a search that finds nothing still reaches the sidebar', async ({
    app,
    page,
  }) => {
    // No row in the tree: focusTree has nothing to focus, and ⌘1 silently does nothing.
    await row(page, 'Ideas').click();
    await twoPanes(page);
    await page.getByRole('searchbox').fill('zzzz');
    await expect(page.locator('.sidebar__empty')).toContainText('No notes match.');
    await clickMenu(app, 'View', 'Go to Page');
    await expect.poll(() => focusIn(page, '.page')).toBe(true);
    await clickMenu(app, 'View', 'Go to Sidebar');
    await expect.poll(() => focusIn(page, '.sidebar')).toBe(true);
  });

  test('the panes toggle pressed from the keyboard keeps the keyboard', async ({ page }) => {
    // The sidebar redraws for two panes; the foot's controls stay, and the keyboard on them.
    await ready(page);
    await page.getByRole('button', { name: 'Two panes', pressed: false }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
    await expect(page.getByRole('button', { name: 'Two panes', pressed: true })).toBeFocused();
  });

  test('two panes: a folder opened by its arrow from the keyboard keeps the keyboard', async ({
    page,
  }) => {
    await ready(page);
    await twoPanes(page);
    await page.getByRole('button', { name: 'Open Research' }).focus();
    await page.keyboard.press('Enter');
    await expect(treeNote(page, 'Wool')).toBeVisible();
    await expect.poll(() => focusIn(page, '.sidebar')).toBe(true);
  });

  test('Settings closed after choosing two panes gives the keyboard back to the sidebar', async ({
    page,
  }) => {
    // The dialog hands the keyboard back to the Settings button it opened from, which the
    // panes' redraw replaced.
    await ready(page);
    await page.getByRole('button', { name: 'Settings' }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.locator('dialog.settings');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Lists', exact: true }).click();
    await dialog.locator('[data-value="two"]').click();
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect.poll(() => focused(page)).not.toBe('body');
  });
});

test.describe('a pane shut while something in it is being used', () => {
  test('a folder’s menu left open as the sidebar shuts: its Rename still shows a field to type in', async ({
    app,
    page,
  }) => {
    // The menu outlives its pane; Rename then draws the field in the shut sidebar, unseen, and
    // the keyboard goes back to the hidden row: what the writer types next goes nowhere.
    await row(page, 'Ideas').click();
    await folder(page, 'Research').click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await expect(page.locator('.sidebar__show')).toBeVisible();
    if (await page.getByRole('menu').isVisible()) {
      await page.getByRole('menuitem', { name: 'Rename' }).click();
      await expect(page.locator('.tree-row__field')).toBeVisible();
      await expect(page.locator('.tree-row__field')).toBeFocused();
    }
  });

  test('hardening: ⌘\\ mid-rename keeps the name typed, as leaving the field does, and the page has the keyboard', async ({
    app,
    page,
    vault,
  }) => {
    await row(page, 'Ideas').click();
    await folder(page, 'Research').focus();
    await page.keyboard.press('F2');
    await page.keyboard.type('Notes');
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await expect.poll(() => folders(vault)).toEqual(['Fic', 'Notes']);
    await expect.poll(() => focusIn(page, '.page')).toBe(true);
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await expect(folder(page, 'Notes')).toBeVisible();
    await expect(page.locator('.tree-row__field')).toHaveCount(0);
  });

  test('hardening: the panes shut and opened while the page’s title is being renamed leave the field and its words', async ({
    app,
    page,
    vault,
  }) => {
    await row(page, 'Ideas').click();
    await page.locator('.title').click();
    await expect(page.locator('.title__field')).toBeFocused();
    await page.keyboard.type('Thaw');
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await clickMenu(app, 'View', 'Toggle Note List');
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await clickMenu(app, 'View', 'Toggle Note List');
    await expect(page.locator('.title__field')).toBeFocused();
    await expect(page.locator('.title__field')).toHaveValue('Thaw');
    await page.keyboard.press('Enter');
    await expect.poll(() => readdirSync(at(vault, '')).sort()).toContain('Thaw.md');
  });

  test('hardening: two panes, the sidebar shut and opened mid-search, keeps the words and the results', async ({
    app,
    page,
  }) => {
    await ready(page);
    await twoPanes(page);
    const search = page.getByRole('searchbox');
    await search.fill('wool');
    await expect(treeNotes(page)).toHaveText(['Wool']);
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await expect(search).toBeHidden();
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await expect(search).toHaveValue('wool');
    await expect(treeNotes(page)).toHaveText(['Wool']);
  });
});

test.describe('renaming a folder in place: where the keyboard goes after', () => {
  test('a refused name leaves the keyboard on the folder being renamed, not on the one with that name', async ({
    page,
    vault,
  }) => {
    // The keyboard goes back to the row named as typed: when that name is taken, it lands on
    // the other folder, and the writer's retry (F2 again) renames the wrong one.
    await ready(page);
    await folder(page, 'Research').focus();
    await page.keyboard.press('F2');
    await expect(page.locator('.tree-row__field')).toBeFocused();
    await page.keyboard.type('Fic');
    await page.keyboard.press('Enter');
    await expect(page.locator('.list__notice')).toContainText('already has that name');
    await expect(page.locator('.tree-row__field')).toHaveCount(0);
    await page.keyboard.press('F2');
    await page.keyboard.type('Archive');
    await page.keyboard.press('Enter');
    await expect.poll(() => folders(vault)).toContain('Archive');
    expect(folders(vault)).toEqual(['Archive', 'Fic']);
  });

  test('a name the disk can’t hold as typed (a colon) is cleaned, and the keyboard follows it', async ({
    page,
    vault,
  }) => {
    // "Field: Notes" is made "Field Notes"; the refocus key is still the typed name, so it's lost.
    await ready(page);
    await folder(page, 'Research').focus();
    await page.keyboard.press('F2');
    await page.keyboard.type('Field: Notes');
    await page.keyboard.press('Enter');
    await expect.poll(() => readdirSync(at(vault, '')).sort()).toContain('Field Notes');
    await expect(folder(page, 'Field Notes')).toBeVisible();
    await expect(folder(page, 'Field Notes')).toBeFocused();
  });
});

test.describe('widths in a narrow window', () => {
  test('a step wider, in a window too narrow to show it, never leaves the pane narrower later', async ({
    app,
    page,
  }) => {
    // The step starts from the narrowed width shown, not the one remembered: pressing → on a
    // 480 px list in a small window remembers 292, and the wide window gets a narrow list back.
    await ready(page);
    await setWindow(app, 1400, 800);
    await expect.poll(() => listWidth(page)).toBe(316);
    const edge = page.locator('.pane-edge--list');
    await edge.focus();
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
    await expect(edge).toHaveAttribute('aria-valuenow', '480');
    await setWindow(app, 900, 800);
    await expect.poll(() => listWidth(page)).toBe(276);
    await page.keyboard.press('ArrowRight');
    await setWindow(app, 1400, 800);
    await expect.poll(() => listWidth(page)).toBe(480);
  });

  test(
    'a drag the window can’t follow (a narrow window) doesn’t forget the sidebar’s width',
    ALONE,
    async ({ app, page }) => {
      // Same cause, with the pointer: the sidebar's edge dragged wider in a small window (where it
      // can't widen) remembers the narrowed width plus the drag, less than it was.
      await ready(page);
      await setWindow(app, 1400, 800);
      const edge = page.locator('.pane-edge--sidebar');
      await edge.focus();
      for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
      await expect(edge).toHaveAttribute('aria-valuenow', '420');
      await setWindow(app, 800, 800);
      await expect.poll(() => sidebarWidth(page)).toBe(200); // the slide done: the edge is still
      const box = await boxOf(edge);
      await page.mouse.move(box.x + box.width / 2, 300);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 60, 300, { steps: 4 });
      await page.mouse.up();
      await setWindow(app, 1400, 800);
      await expect.poll(() => sidebarWidth(page)).toBe(420);
    },
  );

  test(
    'hardening: an edge whose button was let go outside the window stops at the next move',
    ALONE,
    async ({ page }) => {
      await ready(page);
      const before = await sidebarWidth(page);
      const box = await boxOf(page.locator('.pane-edge--sidebar'));
      const x = box.x + box.width / 2;
      await page.mouse.move(x, 300);
      await page.mouse.down();
      await page.mouse.move(x + 40, 300, { steps: 4 });
      await expect.poll(() => sidebarWidth(page)).toBe(before + 40);
      // The button came up over another app: the window next hears a move with no button.
      await page.evaluate(
        ([x]) =>
          document.dispatchEvent(
            new PointerEvent('pointermove', {
              clientX: x,
              clientY: 300,
              buttons: 0,
              bubbles: true,
            }),
          ),
        [x + 40] as const,
      );
      await expect(page.locator('.shell')).not.toHaveClass(/is-resizing/);
      await page.mouse.move(x + 140, 300, { steps: 4 });
      await page.mouse.up();
      await expect.poll(() => sidebarWidth(page)).toBe(before + 40);
    },
  );

  test(
    'hardening: the window resized mid-drag keeps the page at its narrowest',
    ALONE,
    async ({ app, page }) => {
      await ready(page);
      const box = await boxOf(page.locator('.pane-edge--list'));
      const x = box.x + box.width / 2;
      await page.mouse.move(x, 300);
      await page.mouse.down();
      await page.mouse.move(x + 100, 300, { steps: 4 });
      await setWindow(app, 700, 800);
      await page.mouse.move(x + 50, 300, { steps: 4 });
      await page.mouse.up();
      const page_ = await width(page.locator('.page'));
      expect(page_).toBeGreaterThanOrEqual(700 - 200 - 260 - 1);
      await expect.poll(() => listWidth(page)).toBe(260);
    },
  );
});

test.describe('two panes’ tree', () => {
  test(
    'a note dragged in the tree follows the pointer, as it does from the list',
    ALONE,
    async ({ page }) => {
      // The lifted copy has the list's .is-lifted look only on .note-row: in the tree it sits,
      // unpositioned, at the bottom of the folders, and nothing follows the pointer.
      await ready(page);
      await twoPanes(page);
      const from = await boxOf(treeNote(page, 'Ideas'));
      await page.mouse.move(from.x + 30, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + 30, from.y + from.height / 2 + 12, { steps: 3 });
      await page.mouse.move(900, 500, { steps: 6 });
      const lifted = await page.locator('.is-lifted').boundingBox();
      await page.keyboard.press('Escape');
      await page.mouse.up();
      expect(lifted, 'a lifted row').not.toBeNull();
      expect(Math.abs((lifted?.y ?? 0) + (lifted?.height ?? 0) / 2 - 500)).toBeLessThan(40);
      expect(lifted?.x ?? 0).toBeGreaterThan(700);
    },
  );

  test(
    'hardening: a tree note dropped on its own folder, or the vault’s name, stays put',
    ALONE,
    async ({ page, vault }) => {
      await ready(page);
      await twoPanes(page);
      const drag = async (source: Locator, target: Locator) => {
        const from = await boxOf(source);
        const to = await boxOf(target);
        await page.mouse.move(from.x + 30, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(from.x + 30, from.y + from.height / 2 + 12, { steps: 3 });
        await page.mouse.move(to.x + 20, to.y + to.height / 2, { steps: 6 });
        await page.mouse.up();
      };
      await drag(treeNote(page, 'Ideas'), page.locator('.sidebar__vault'));
      await folder(page, 'Research').click();
      await drag(treeNote(page, 'Wool'), folder(page, 'Research'));
      await page.waitForTimeout(300); // nothing to wait for: nothing should happen
      expect(readdirSync(at(vault, 'Research'))).toEqual(['Wool.md']);
      expect(readdirSync(at(vault, '')).filter((name) => name.endsWith('.md'))).toEqual([
        'Ideas.md',
      ]);
      await expect(page.locator('.sidebar__notice')).toBeHidden();
      await expect(treeNotes(page)).toHaveText(['Wool', 'Ideas']);
    },
  );

  test('hardening: one note under its folder, a tag, Pinned and All Notes is one note everywhere', async ({
    page,
    vault,
  }) => {
    await ready(page);
    await row(page, 'Needle').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Pin' }).click();
    // Pinned is always there: its count says the pin is in.
    await expect(folder(page, 'Pinned').locator('.count')).toHaveText('1');
    await twoPanes(page);
    await folder(page, 'Fic').click();
    await folder(page, 'Scarf').click();
    await folder(page, 'Pinned').click();
    await folder(page, '#winter').click();
    await folder(page, 'All Notes').click();
    await expect(treeNote(page, 'Needle')).toHaveCount(4);
    await treeNote(page, 'Needle').nth(2).click();
    await expect(page.locator('.title')).toHaveText('Needle');
    await expect(page.locator('.tree-row--note [aria-current="true"]')).toHaveCount(4);

    // The keyboard on the tag's row stays on that row through a redraw from the disk.
    const underTag = page.locator('[data-key="note:/#winter:Fic/Scarf/Needle.md"]');
    await underTag.focus();
    writeFileSync(at(vault, 'From the phone.md'), 'synced\n');
    await expect(page.locator('.sidebar__count')).toHaveText('6 notes');
    await expect(underTag).toBeFocused();

    // F2 from the tag's row renames the note in that row, and every row shows the new name.
    await page.keyboard.press('F2');
    await expect(page.locator('.name-field__input')).toBeFocused();
    await page.keyboard.type('Pin');
    await page.keyboard.press('Enter');
    await expect(treeNote(page, 'Pin')).toHaveCount(4);
    await expect.poll(() => readdirSync(at(vault, 'Fic/Scarf')).sort()).toContain('Pin.md');
    expect(readFileSync(at(vault, '.eien/pinned.json'), 'utf8')).toContain('Fic/Scarf/Pin.md');
  });
});

test.describe('look-alike names', () => {
  test.use({
    vaultFiles: {
      '#drafts/Draft.md': 'a folder named like a tag\n',
      'Loose.md': 'loose #drafts\n',
    },
  });

  test('hardening: a folder named "#drafts" and the tag #drafts open, and list, apart', async ({
    page,
  }) => {
    await expect(page.locator('.note-row').first()).toBeVisible();
    await twoPanes(page);
    await expect(page.locator('[data-key="folder:#drafts"]')).toBeVisible();
    await expect(page.locator('[data-key="tag:drafts"]')).toBeVisible();
    await page.locator('[data-key="folder:#drafts"]').click();
    await expect(treeNotes(page)).toHaveText(['Draft', 'Loose']);
    await page.locator('[data-key="tag:drafts"]').click();
    await expect(page.locator('[data-key^="note:/#drafts:"]')).toHaveText([/Loose/]);
    await page.locator('[data-key="folder:#drafts"]').click();
    await expect(page.locator('[data-key^="note:#drafts:"]')).toHaveCount(0);
    await expect(page.locator('[data-key^="note:/#drafts:"]')).toHaveCount(1);
  });
});

test.describe('search while the panes change', () => {
  test('hardening: three to two and back with a search on, then cleared, leaves nothing stale', async ({
    page,
  }) => {
    await ready(page);
    const search = page.getByRole('searchbox');
    await search.fill('wool');
    await expect(page.locator('.note-row__title')).toHaveText(['Wool']);
    await twoPanes(page);
    await expect(page.locator('.sidebar__label')).toHaveText(['Results']);
    await expect(treeNotes(page)).toHaveText(['Wool']);
    await search.press('Escape');
    await expect(page.locator('.sidebar__label')).toHaveText(['Library', 'Folders', 'Tags']);
    await page.getByRole('button', { name: 'Two panes', pressed: true }).click();
    await expect(page.locator('.list__heading')).toHaveText('All Notes');
    await expect(page.locator('.note-row')).toHaveCount(5);
  });

  test('hardening: words typed, then two panes chosen before the search runs, find the right notes', async ({
    page,
  }) => {
    await ready(page);
    const search = page.getByRole('searchbox');
    await search.fill('sew');
    await page.getByRole('button', { name: 'Two panes', pressed: false }).click(); // within the search's 150 ms
    await expect(page.locator('.sidebar__label')).toHaveText(['Results']);
    await expect(treeNotes(page)).toHaveText(['Needle']);
    await search.fill('snow');
    await page.getByRole('button', { name: 'Two panes', pressed: true }).click();
    await expect(page.locator('.note-row__title')).toHaveText(['Ideas']);
    await expect(page.locator('.sidebar__label')).toHaveText(['Library', 'Folders', 'Tags']);
  });

  test('hardening: the list shut and opened mid-search, then cleared from the sidebar, shows the folder', async ({
    app,
    page,
  }) => {
    await ready(page);
    await folder(page, 'Research').click();
    const search = page.getByRole('searchbox');
    await search.fill('snow');
    // From the list's band: only Research's notes, and Ideas isn't one.
    await expect(page.locator('.list__empty')).toContainText('No notes match.');
    await clickMenu(app, 'View', 'Toggle Note List');
    await expect(treeNotes(page)).toHaveText(['Ideas']); // from the sidebar: the whole vault
    await page.locator('.sidebar__search').getByRole('button', { name: 'Clear search' }).click();
    await clickMenu(app, 'View', 'Toggle Note List');
    await expect(page.locator('.list__heading')).toHaveText('Research');
    await expect(page.locator('.note-row__title')).toHaveText(['Wool']);
  });
});

test.describe('hostile stored state', () => {
  test('hardening: garbage remembered for the panes opens the defaults, and the app works', async ({
    app,
    page,
    userData,
    vault,
  }) => {
    await ready(page);
    await page.evaluate(() =>
      localStorage.setItem(
        'eien.panes',
        '{"sidebar":"wide","list":1e999,"sidebarTwo":-1,"sidebarShut":"yes","__proto__":{"listShut":true}}',
      ),
    );
    await closeApp(app);
    const again = await launchApp(userData, vault);
    try {
      const page2 = await again.firstWindow();
      await expect(page2.locator('.note-row').first()).toBeVisible();
      await expect.poll(() => sidebarWidth(page2)).toBe(264);
      await expect.poll(() => listWidth(page2)).toBe(316);
      await clickMenu(again, 'View', 'Toggle Sidebar');
      await expect(page2.locator('.sidebar__show')).toBeVisible();
    } finally {
      await closeApp(again);
    }
  });

  test('hardening: storage that refuses every write still shuts, opens and resizes the panes', async ({
    app,
    page,
  }) => {
    await ready(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      };
    });
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await expect(page.locator('.sidebar__show')).toBeVisible();
    await clickMenu(app, 'View', 'Toggle Sidebar');
    await expect(page.locator('.sidebar__vault')).toBeVisible();
    await page.locator('.pane-edge--list').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => listWidth(page)).toBe(332);
    expect(errors).toEqual([]);
  });

  test('hardening: toggled eleven times quickly, the sidebar ends shut, as remembered', async ({
    app,
    page,
  }) => {
    await ready(page);
    await Promise.all(Array.from({ length: 11 }, () => clickMenu(app, 'View', 'Toggle Sidebar')));
    await expect(page.locator('.sidebar__show')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('eien.panes') ?? '{}')))
      .toMatchObject({ sidebarShut: true });
  });

  test(
    'hardening: no style attribute is refused by the security policy while the panes move',
    ALONE,
    async ({ app, page }) => {
      await ready(page);
      const refused: string[] = [];
      page.on('console', (message) => {
        if (/Content Security Policy/i.test(message.text())) refused.push(message.text());
      });
      await page.evaluate(() => {
        const w = window as unknown as { refused: string[] };
        w.refused = [];
        document.addEventListener('securitypolicyviolation', (event) =>
          w.refused.push(`${event.violatedDirective} ${event.sample}`),
        );
      });
      const box = await boxOf(page.locator('.pane-edge--sidebar'));
      await page.mouse.move(box.x + 2, 300);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, 300, { steps: 4 });
      await page.mouse.up();
      await twoPanes(page);
      await folder(page, 'Fic').click();
      await folder(page, 'Scarf').click();
      const from = await boxOf(treeNote(page, 'Needle'));
      const to = await boxOf(folder(page, 'Research'));
      await page.mouse.move(from.x + 30, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + 30, to.y + to.height / 2, { steps: 8 });
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await clickMenu(app, 'View', 'Toggle Sidebar');
      await clickMenu(app, 'View', 'Toggle Sidebar');
      const inPage = await page.evaluate(
        () => (window as unknown as { refused: string[] }).refused,
      );
      expect([...refused, ...inPage]).toEqual([]);
    },
  );
});

test.describe('the Layout setting in the device file', () => {
  for (const value of ['four', 2, null, 'Two', '__proto__']) {
    test.describe(`set to ${JSON.stringify(value)}`, () => {
      test.use({ deviceFile: { settings: { 'layout.panes': value } } });
      test('hardening: opens three panes', async ({ page }) => {
        await ready(page);
        await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'three');
        await expect(page.locator('.list')).toBeVisible();
      });
    });
  }
});

test.describe('changing the panes mid-sentence', () => {
  test('hardening: two panes chosen in Settings while a note is mid-edit keeps every word', async ({
    page,
    vault,
  }) => {
    await row(page, 'Ideas').click();
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' More snow fell.');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page
      .locator('dialog.settings')
      .getByRole('button', { name: 'Lists', exact: true })
      .click();
    await page.locator('dialog.settings [data-value="two"]').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' And more.');
    await page.getByRole('button', { name: 'Two panes', pressed: true }).click();
    await expect
      .poll(() => readFileSync(at(vault, 'Ideas.md'), 'utf8'))
      .toMatch(/^Snow on the walls\. #winter\s*More snow fell\. And more\.\s*$/);
  });
});

test.describe('an empty vault', () => {
  test.use({ vaultFiles: {} });
  test('hardening: ⌘1 and ⌘2 find something to give the keyboard', async ({ app, page }) => {
    await expect(page.locator('.tree-row__name').first()).toBeVisible();
    await clickMenu(app, 'View', 'Go to Sidebar');
    await expect.poll(() => focusIn(page, '.sidebar')).toBe(true);
    await clickMenu(app, 'View', 'Go to Note List');
    await expect.poll(() => focusIn(page, '.list')).toBe(true);
    await twoPanes(page);
    await clickMenu(app, 'View', 'Go to Sidebar');
    await expect.poll(() => focusIn(page, '.sidebar')).toBe(true);
  });
});

const MANY: VaultFiles = Object.fromEntries(
  Array.from({ length: 3000 }, (_, i) => [`Note ${i}.md`, `Words of note ${i}. #many\n`]),
);

test.describe('three thousand notes', () => {
  test.use({ vaultFiles: { ...MANY, 'Chapter.md': 'The first line.\n' } });

  test(
    'hardening: two panes with All Notes open draws them, and typing never stalls',
    ALONE,
    async ({ page, vault }) => {
      test.setTimeout(90_000);
      await expect(page.locator('.note-row').first()).toBeVisible({ timeout: 30_000 });
      // Each long task with when it started: an entry comes to the observer after its task has
      // ended, maybe after a later evaluate, so a window counts the tasks that started in it.
      // Chromium reports a task a little after it ends: `longest` waits a moment, then takes them.
      type Long = {
        long: { start: number; ms: number }[];
        since: number;
        observer: PerformanceObserver;
      };
      await page.evaluate(() => {
        const w = window as unknown as Long;
        w.long = [];
        w.since = 0;
        w.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            w.long.push({ start: entry.startTime, ms: Math.round(entry.duration) });
          }
        });
        w.observer.observe({ type: 'longtask' });
      });
      const longest = () =>
        page.evaluate(async () => {
          const w = window as unknown as Long;
          await new Promise((done) => setTimeout(done, 150));
          for (const entry of w.observer.takeRecords()) {
            w.long.push({ start: entry.startTime, ms: Math.round(entry.duration) });
          }
          return Math.max(
            0,
            ...w.long.filter((task) => task.start >= w.since).map((task) => task.ms),
          );
        });
      await twoPanes(page);
      await folder(page, 'All Notes').click();
      // Two lists of 3,001 notes (the vault's own, All Notes): each draws only the rows in sight,
      // and each row says where it stands among them all.
      await expect(page.locator('.tree-window')).toHaveCount(2, { timeout: 30_000 });
      await expect(page.locator('.tree-window .tree-row--note').first()).toHaveAttribute(
        'aria-setsize',
        '3001',
      );
      expect(await page.locator('.tree-row--note').count()).toBeLessThan(200);
      expect(await longest()).toBeLessThan(200);
      // A file arriving from another device redraws all six thousand rows.
      writeFileSync(at(vault, 'From the phone.md'), 'synced\n');
      await expect(page.locator('.sidebar__count')).toHaveText('3,002 notes', { timeout: 30_000 });
      // From here on, typing: the redraw for the phone's note (which may be reported late) and
      // this evaluate's own work are before the window.
      await page.evaluate(() => {
        const w = window as unknown as Long & { drawn: WeakSet<Element> };
        // The note rows drawn now: opening a note and saving it should change two rows (the
        // note's, under the vault and under All Notes), and leave the other six thousand be.
        w.drawn = new WeakSet(document.querySelectorAll('.tree-row--note'));
        w.since = performance.now();
      });
      // By its path, a selector the window answers itself: a locator that filters six thousand rows by
      // their text runs in the window too, and would be the long task measured.
      await page.locator('.tree-row__name[data-path="Chapter.md"]').first().click();
      await editorContent(page).click();
      await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.type(' The writer keeps typing along here.', { delay: 60 });
      await expect
        .poll(() => readFileSync(at(vault, 'Chapter.md'), 'utf8'))
        .toContain('along here');
      // Saved, it's the newest: first under All Notes, moved there without a redraw. Asked with
      // querySelector, which costs the window nothing, unlike a locator over six thousand rows.
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>('.tree-group .tree-row--note .tree-row__name')
            ?.dataset.path === 'Chapter.md',
      );
      expect(await longest()).toBeLessThan(200);
      const made = await page.evaluate(() => {
        const { drawn } = window as unknown as { drawn: WeakSet<Element> };
        return [...document.querySelectorAll('.tree-row--note')].filter((row) => !drawn.has(row))
          .length;
      });
      expect(made).toBeLessThanOrEqual(4);
    },
  );
});
