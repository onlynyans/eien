// Adversarial: phase 10b's phone layout (spec §10, §4's keyboard rule, §1)
// on a Pixel 7's screen, and the menu's place on a wider window. Each test
// names what a writer would see or lose; each failed against 9f7d1d9 for the
// reason its comment gives.
//
// Android's back is played through Capacitor's own web App plugin. On the web
// the plugin's implementation is loaded lazily, and the preload's first
// listeners race to load it: two instances are made, and the back listener
// isn't always on the one the proxy keeps. So every instance is caught as it
// is made, and the back goes to whichever holds a listener for it.

import { devices, expect, type Page, test } from '@playwright/test';
import { listOutside, open, putOutside, titles } from './outside';

test.use({ ...devices['Pixel 7'] });

interface WebPlugin {
  readonly listeners: Record<string, unknown[] | undefined>;
  notifyListeners(event: string, data: object): void;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const plugins: object[] = [];
    Object.defineProperty(window, '__webPlugins', { value: plugins });
    // Capacitor's WebPlugin constructor assigns this field: each instance is caught here.
    Object.defineProperty(Object.prototype, 'retainedEventArguments', {
      configurable: true,
      set(value) {
        plugins.push(this);
        Object.defineProperty(this, 'retainedEventArguments', {
          value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      },
    });
  });
});

/** Android's back button or gesture. */
const systemBack = (page: Page) =>
  page.evaluate(() => {
    const plugins = (window as unknown as { __webPlugins: WebPlugin[] }).__webPlugins;
    const holding = plugins.filter((plugin) => (plugin.listeners?.backButton?.length ?? 0) > 0);
    if (holding.length === 0) throw new Error('nothing listens for the back button');
    for (const plugin of holding) plugin.notifyListeners('backButton', { canGoBack: false });
  });

const shell = (page: Page) => page.locator('.shell');
const back = (page: Page) => page.locator('.phone-bar__back');
const more = (page: Page) => page.locator('.phone-bar__more');
const menuItem = (page: Page, label: string) =>
  page.locator('.menu [role^="menuitem"]', { hasText: new RegExp(`^${label}$`, 'u') });

/** The pane on a phone's screen. */
const shown = (page: Page) => shell(page).getAttribute('data-shown');

/**
 * Where the keyboard is: the pane (or the bar, a dialog, a menu) holding it,
 * when that's in sight; null when it's nowhere (the body) or on something hidden.
 */
const keyboardAt = (page: Page) =>
  page.evaluate(() => {
    const at = document.activeElement;
    if (!(at instanceof HTMLElement) || at === document.body) return null;
    if (!at.checkVisibility({ visibilityProperty: true })) return null;
    const holder = at.closest(
      '.shell > .sidebar, .shell > .list, .shell > .page, .phone-bar, dialog, .menu',
    );
    return holder ? holder.classList[0] : 'elsewhere';
  });

async function withNotes(page: Page): Promise<void> {
  await open(page);
  await putOutside(page, 'Eien/Vault/Fic/Tear.md', 'The scarf caught on the gate, and tore.\n');
  await putOutside(page, 'Eien/Vault/Fic/Mend.md', '# Mend\n\nShe mended it by the fire.\n');
  await putOutside(page, 'Eien/Vault/Ideas.md', 'An idea.\n');
  await expect(titles(page)).toHaveCount(3, { timeout: 10_000 });
}

async function openNote(page: Page, title: string): Promise<void> {
  await titles(page).filter({ hasText: title }).click();
  await expect(shell(page)).toHaveAttribute('data-shown', 'page');
}

test.describe('back', () => {
  test('Rename from a note’s menu, on the note already open, shows its title as a field', async ({
    page,
  }) => {
    // vault-view.ts renameNote opens the note (and so the page) only when another note is open.
    // On the note already open, page.editTitle() puts the field on the page out of sight: the
    // writer chooses Rename and nothing happens, and the next time the page shows, its title is
    // an unfocused field with the old name in it.
    await withNotes(page);
    await openNote(page, 'Ideas');
    await back(page).click();
    await page.locator('.note-row', { hasText: 'Ideas' }).click({ button: 'right' });
    await menuItem(page, 'Rename').click();
    await expect(shell(page)).toHaveAttribute('data-shown', 'page');
    await expect(page.locator('.title__field')).toBeFocused();
  });

  test('the system back while the title is renamed closes the field, and renames nothing', async ({
    page,
  }) => {
    // phone-view.ts back() doesn't know the title field: it goes a pane back, the field loses
    // the keyboard, and its blur keeps what was typed. The writer presses back to get out of the
    // rename (Esc's job on the desktop) and finds the note renamed to half a title.
    await withNotes(page);
    await openNote(page, 'Ideas');
    await page.locator('.title').click();
    await page.locator('.title__field').fill('Idea half');
    await systemBack(page);
    await expect(shell(page)).toHaveAttribute('data-shown', 'page');
    await expect(page.locator('.title__field')).toBeHidden();
    await page.waitForTimeout(1500); // a rename would have reached the disk by now
    expect(await listOutside(page, 'Eien/Vault')).toEqual(['Fic', 'Ideas.md']);
  });

  test('the system back while Compare shows a seal gives the draft back, on the page', async ({
    page,
  }) => {
    // Esc in Compare gives the draft back (compare-view.ts); back skips it and leaves the page,
    // as though nothing were open over the note.
    await withNotes(page);
    await openNote(page, 'Ideas');
    await more(page).click();
    await menuItem(page, 'Seal').click();
    await expect(page.locator('.seal-line')).toHaveText('Sealed just now');
    await more(page).click();
    await menuItem(page, 'Compare').click();
    await expect(page.locator('.compare')).toBeVisible();
    await systemBack(page);
    await expect(shell(page)).toHaveAttribute('data-shown', 'page');
    await expect(page.locator('.compare')).toHaveCount(0);
  });

  test('the system back on the list goes back, though the bar’s back left the versions open', async ({
    page,
  }) => {
    // The bar's back (phone-stack.ts) goes a pane back and leaves the versions panel open on the
    // page now out of sight. The system's back on the list then closes that panel, which the
    // writer can't see, and stays: the writer presses back and nothing happens.
    await withNotes(page);
    await openNote(page, 'Ideas');
    await more(page).click();
    await menuItem(page, 'Versions').click();
    await expect(page.locator('.versions')).toBeVisible();
    await back(page).click();
    await expect(shell(page)).toHaveAttribute('data-shown', 'list');
    await systemBack(page);
    await expect(shell(page)).toHaveAttribute('data-shown', 'sidebar');
  });

  test('the system back on the list never takes the keyboard off the list', async ({ page }) => {
    // As above, with the outline cards left open: closing them calls page.focus() on the page out
    // of sight, and on a touch screen, for a note whose title is its own heading (page.ts), that
    // blurs whatever has the keyboard: the list's row. The keyboard is left nowhere.
    await withNotes(page);
    await putOutside(
      page,
      'Eien/Vault/Fic/.eien-folder.json',
      '{"book":{},"order":["Mend.md","Tear.md"]}',
    );
    await back(page).click();
    await page.locator('.sidebar').getByText('Fic', { exact: true }).click();
    await openNote(page, 'Mend');
    await more(page).click();
    await menuItem(page, 'Outline cards').click();
    await expect(page.locator('.card').first()).toBeVisible();
    await back(page).click();
    await expect(page.locator('.note-row', { hasText: 'Mend' })).toBeFocused();
    await systemBack(page);
    await page.waitForTimeout(300);
    expect(await keyboardAt(page)).toBe(await shown(page));
  });
});

test.describe('turned sideways or upright', () => {
  test('the keyboard in the search field, turned upright onto the page: it goes to the page', async ({
    page,
  }) => {
    // phone-stack.ts #onNarrow lays the panes out again and moves no keyboard: the search field
    // the writer was in (on the list's band, sideways) goes out of sight with the keyboard in it,
    // and Chromium leaves it on the body (spec §4: a shut pane gives the keyboard to the page).
    await withNotes(page);
    await page.setViewportSize({ width: 915, height: 412 });
    await titles(page).filter({ hasText: 'Ideas' }).click();
    await page.getByRole('searchbox').focus();
    await page.setViewportSize({ width: 412, height: 915 });
    await expect(shell(page)).toHaveAttribute('data-shown', 'page');
    await page.waitForTimeout(300);
    expect(await keyboardAt(page)).toBe('page');
  });

  test('the keyboard in the list, turned sideways with two panes: it isn’t lost', async ({
    page,
  }) => {
    // Two panes chosen: sideways, the list goes (and turns inert) with the keyboard on its row.
    // setTwo() hands the keyboard on when the setting changes; a turn of the phone doesn't.
    await withNotes(page);
    await page.evaluate(() => window.eien.settings.set('layout.panes', 'two'));
    await page.reload();
    await expect(titles(page)).toHaveCount(3, { timeout: 10_000 });
    await page.locator('.note-row').first().focus();
    await page.setViewportSize({ width: 915, height: 412 });
    await expect(shell(page)).toHaveAttribute('data-panes', 'two');
    await page.waitForTimeout(300);
    expect(await keyboardAt(page)).not.toBeNull();
  });

  test('the ⋯ open, turned sideways: the keyboard isn’t lost with the bar', async ({ page }) => {
    // The menu closes on the width's change and gives the keyboard back to ⋯ (menu.ts); a moment
    // later the bar is hidden, ⋯ with it, and the keyboard is on nothing.
    await withNotes(page);
    await openNote(page, 'Ideas');
    await more(page).click();
    await expect(page.locator('.menu')).toBeVisible();
    await page.setViewportSize({ width: 915, height: 412 });
    await expect(page.locator('.menu')).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(await keyboardAt(page)).not.toBeNull();
  });
});

test.describe('the back bar names where it goes', () => {
  /** The list drawn anew, not as it was when it went out of sight: the open note's row is marked. */
  const listDrawn = (page: Page) =>
    expect(page.locator('.note-row[aria-current="true"]')).toBeVisible();

  test('after a search in the tree, the page’s back names the list it goes to', async ({
    page,
  }) => {
    // backName() (phone-view.ts) reads the list's heading, but a list out of sight isn't drawn
    // (pane-drawer.ts): the bar says "‹ All Notes", and back shows the search's “scarf”.
    await withNotes(page);
    await back(page).click();
    await page.getByRole('searchbox').fill('scarf');
    await page.locator('.sidebar').getByText('Tear').click();
    await expect(shell(page)).toHaveAttribute('data-shown', 'page');
    const said = (await back(page).textContent())?.replace(/^‹ /u, '');
    await back(page).click();
    await listDrawn(page);
    expect(await page.locator('.list__heading').textContent()).toBe(said);
  });

  test('after New note here in the tree, the page’s back names the folder it goes to', async ({
    page,
  }) => {
    // The same: the folder chosen from its menu while the list was out of sight. The bar says
    // "‹ All Notes", and back shows Fic.
    await withNotes(page);
    await back(page).click();
    await page.locator('.sidebar').getByText('Fic', { exact: true }).click({ button: 'right' });
    await menuItem(page, 'New note here').click();
    await expect(shell(page)).toHaveAttribute('data-shown', 'page');
    await expect(page.locator('.cm-content')).toBeFocused();
    const said = (await back(page).textContent())?.replace(/^‹ /u, '');
    await back(page).click();
    await listDrawn(page);
    expect(await page.locator('.list__heading').textContent()).toBe(said);
  });
});

test.describe('what a phone offers', () => {
  test('the settings offer no two panes on a phone', async ({ page }) => {
    // Spec §10: "Two panes aren't offered: one shows at a time." phone.css hides the sidebar's
    // pair, but the settings screen still lists Panes (Three, Two) on the phone.
    await withNotes(page);
    await openNote(page, 'Ideas');
    await more(page).click();
    await menuItem(page, 'Settings').click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    expect(await page.locator('dialog .setting__label').allTextContents()).not.toContain('Panes');
  });

  test('the tree’s seal does something on a phone, or isn’t there', async ({ page }) => {
    // phone.css hides the page's SIDEBAR and LIST ("back stands in for them") but not the seal
    // at the top of the tree, labelled Hide sidebar. On a phone panes.toggle() returns at once:
    // the writer taps the seal and nothing happens.
    await withNotes(page);
    await back(page).click();
    const seal = page.getByRole('button', { name: 'Hide sidebar' });
    if (await seal.isVisible()) {
      await seal.tap();
      await expect(shell(page)).not.toHaveAttribute('data-shown', 'sidebar');
    }
  });

  test('a touch screen wide enough for three panes keeps the page’s SIDEBAR and LIST in sight', async ({
    page,
  }) => {
    // phone.css's (hover: none) rule names the views, the seals' tools, the sort and New folder,
    // but not .page__panes: on a tablet, or a phone on its side with the sidebar shut, the page's
    // SIDEBAR and LIST stay at opacity 0, waiting for a hover a finger can't give.
    await page.setViewportSize({ width: 1100, height: 800 });
    await withNotes(page);
    await openNote(page, 'Ideas');
    await expect(page.locator('.page__panes')).toBeVisible();
    await expect(page.locator('.page__panes')).toHaveCSS('opacity', '1');
  });
});

test.describe('a menu stays inside the window', () => {
  /** A book at the foot of a long tree: its menu opens near the bottom. */
  async function bookLow(page: Page): Promise<void> {
    for (let at = 0; at < 14; at++)
      await putOutside(page, `Eien/Vault/F${String(at).padStart(2, '0')}/n.md`, 'x\n');
    await putOutside(page, 'Eien/Vault/Zbook/.eien-folder.json', '{"book":{}}');
    await putOutside(page, 'Eien/Vault/Zbook/a.md', 'x\n');
  }

  test('the word goal’s field stays in sight when the phone’s keyboard comes up', async ({
    page,
  }) => {
    // menu.ts now closes a float only when the width changes, "which leaves it where it is":
    // where it is is under the keyboard. A book low in the tree, Word goal…: the field takes the
    // keyboard, the window gets shorter, and the field is below its bottom, typed into blind.
    await withNotes(page);
    await bookLow(page);
    await back(page).click();
    const book = page.locator('.sidebar').getByText('Zbook', { exact: true });
    await expect(book).toBeVisible({ timeout: 10_000 });
    await book.scrollIntoViewIfNeeded();
    await book.click({ button: 'right' });
    await menuItem(page, 'Word goal…').click();
    const field = page.locator('.ask .field');
    await expect(field).toBeFocused();
    await page.setViewportSize({ width: 412, height: 500 }); // the keyboard comes up
    await page.waitForTimeout(300);
    const box = await field.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(500);
  });
});

test.describe('the desktop', () => {
  test.use({
    viewport: { width: 1100, height: 800 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  });

  test('a menu low in the window, the window made shorter: it closes or stays inside', async ({
    page,
  }) => {
    // Before 10b any resize closed a menu. Now a shorter window (its bottom edge dragged up)
    // leaves the menu where it was, part of it below the window, its last choices out of reach.
    await open(page);
    for (let at = 0; at < 14; at++)
      await putOutside(page, `Eien/Vault/F${String(at).padStart(2, '0')}/n.md`, 'x\n');
    await putOutside(page, 'Eien/Vault/Zbook/.eien-folder.json', '{"book":{}}');
    await putOutside(page, 'Eien/Vault/Zbook/a.md', 'x\n');
    const book = page.locator('.sidebar').getByText('Zbook', { exact: true });
    await expect(book).toBeVisible({ timeout: 10_000 });
    await book.scrollIntoViewIfNeeded();
    await book.click({ button: 'right' });
    const menu = page.locator('.menu');
    await expect(menu).toBeVisible();
    await page.setViewportSize({ width: 1100, height: 520 });
    await page.waitForTimeout(300);
    const box = await menu.boundingBox(); // null: closed, which is fine
    if (box) expect(box.y + box.height).toBeLessThanOrEqual(520);
  });
});
