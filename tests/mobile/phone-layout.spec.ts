// The phone's layout (spec §10), on a Pixel 7's screen: one pane at a time,
// the tree, a folder's notes, then the page; back to the one before; the
// page's ⋯ for what the menu bar offers on the desktop. The system's back is
// Android's, tried on the emulator (tests/android).

import { devices, expect, type Page, test } from '@playwright/test';
import { listOutside, open, putOutside, readOutside, titles } from './outside';

test.use({ ...devices['Pixel 7'] });

type Pane = 'sidebar' | 'list' | 'page';
const PANES: readonly Pane[] = ['sidebar', 'list', 'page'];
const pane = (page: Page, name: Pane) => page.locator(`.shell > .${name}`);
const back = (page: Page) => page.locator('.phone-bar__back');
const more = (page: Page) => page.locator('.phone-bar__more');
const menuItem = (page: Page, label: string) =>
  page.locator('.menu [role^="menuitem"]', { hasText: new RegExp(`^${label}$`, 'u') });

/** Only `name` in sight, and the keyboard in it, the bar, or nowhere: never in a pane out of sight. */
async function onlyShown(page: Page, name: Pane): Promise<void> {
  for (const each of PANES) {
    if (each === name) await expect(pane(page, each)).toBeVisible();
    else await expect(pane(page, each)).toBeHidden();
  }
  const keyboardIn = await page.evaluate(() => {
    const at = document.activeElement?.closest('.shell > .sidebar, .shell > .list, .shell > .page');
    return at ? at.className.split(' ')[0] : null;
  });
  expect([name, null]).toContain(keyboardIn);
}

async function withNotes(page: Page): Promise<void> {
  await open(page);
  await putOutside(page, 'Eien/Vault/Fic/Tear.md', 'The scarf caught on the gate, and tore.\n');
  await putOutside(page, 'Eien/Vault/Fic/Mend.md', '# Mend\n\nShe mended it by the fire.\n');
  await putOutside(page, 'Eien/Vault/Ideas.md', 'An idea.\n');
  await expect(titles(page)).toHaveCount(3, { timeout: 10_000 });
}

test('one pane at a time: the notes, back to the tree, a folder’s notes, a note, and back', async ({
  page,
}) => {
  await withNotes(page);
  await onlyShown(page, 'list');
  await expect(back(page)).toHaveText('‹ Library');
  await back(page).click();
  await onlyShown(page, 'sidebar');
  await expect(back(page)).toBeHidden(); // the tree: nothing before it
  await page.locator('.sidebar').getByText('Fic', { exact: true }).click();
  await onlyShown(page, 'list');
  await expect(page.locator('.list__heading')).toHaveText('Fic');
  await expect(titles(page)).toHaveText(['Mend', 'Tear']);
  await titles(page).filter({ hasText: 'Tear' }).click();
  await onlyShown(page, 'page');
  await expect(page.locator('.title')).toHaveText('Tear');
  await expect(back(page)).toHaveText('‹ Fic');
  await expect(more(page)).toBeVisible();
  await back(page).click();
  await onlyShown(page, 'list');
  await expect(more(page)).toBeHidden();
  await back(page).click();
  await onlyShown(page, 'sidebar');
});

test('the tree’s sections fold at a tap, and a book is marked BOOK', async ({ page }) => {
  await open(page);
  // The book's settings come first, so the folder is a book when it first shows.
  await putOutside(page, 'Eien/Vault/Fic/.eien-folder.json', JSON.stringify({ book: {} }));
  await putOutside(page, 'Eien/Vault/Fic/Tear.md', 'The scarf caught on the gate.\n');
  await putOutside(page, 'Eien/Vault/Ideas/Snow.md', 'Snow on the walls.\n');
  await expect(titles(page)).toHaveCount(2, { timeout: 10_000 });
  await back(page).click();
  await onlyShown(page, 'sidebar');
  const folder = (name: string) =>
    page.locator('.sidebar .tree-row__name').filter({ hasText: new RegExp(`^${name}`) });
  await expect(folder('Fic').locator('.book-mark')).toHaveText('Book');
  await expect(folder('Ideas').locator('.book-mark')).toHaveCount(0);

  const folders = page.locator('.section__label').filter({ hasText: /^Folders$/ });
  await folders.click();
  await expect(folders).toHaveAttribute('aria-expanded', 'false');
  await expect(folder('Fic')).toBeHidden();
  await folders.click();
  await expect(folders).toHaveAttribute('aria-expanded', 'true');
  await expect(folder('Fic')).toBeVisible();
});

test('a note opened to read keeps the phone’s keyboard down', async ({ page }) => {
  // The editor taking the keyboard brings up the phone's keyboard over half the note.
  await withNotes(page);
  await titles(page).filter({ hasText: 'Tear' }).click();
  await expect(page.locator('.title')).toBeFocused();
  // A note that opens with its own heading shows no title: the keyboard leaves, not into the note.
  await back(page).click();
  await titles(page).filter({ hasText: 'Mend' }).click();
  await expect(page.locator('.title')).toBeHidden();
  await expect(page.locator('.cm-content')).not.toBeFocused();
});

test('a new note goes straight into the editor', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await onlyShown(page, 'page');
  await expect(page.locator('.cm-content')).toBeFocused();
  await page.keyboard.type('Written on the phone.');
  await expect
    .poll(() => readOutside(page, 'Eien/Vault/Untitled.md'), { timeout: 5000 })
    .toBe('Written on the phone.');
});

test('the ⋯ seals the note, as File → Seal does', async ({ page }) => {
  await withNotes(page);
  await titles(page).filter({ hasText: 'Ideas' }).click();
  await expect(page.locator('.seal-line')).toHaveText('Not sealed yet');
  await more(page).click();
  await menuItem(page, 'Seal').click();
  await expect(page.locator('.seal-line')).toHaveText('Sealed just now');
  await expect.poll(() => listOutside(page, 'Eien/Vault/.eien/versions')).toHaveLength(1);
});

test('the ⋯ turns focus mode on, and shows it chosen', async ({ page }) => {
  await withNotes(page);
  await titles(page).filter({ hasText: 'Ideas' }).click();
  await more(page).click();
  await expect(menuItem(page, 'Focus mode')).toHaveAttribute('aria-checked', 'false');
  await menuItem(page, 'Focus mode').click();
  await expect
    .poll(() => page.evaluate(async () => (await window.eien.settings.read())['editor.focus']))
    .toBe('on');
  await more(page).click();
  await expect(menuItem(page, 'Focus mode')).toHaveAttribute('aria-checked', 'true');
  // On or off by itself, not one of several: a keyboard's Enter mustn't land on it to turn it off.
  await expect(menuItem(page, 'Focus mode')).toHaveAttribute('role', 'menuitemcheckbox');
  await expect(menuItem(page, 'Seal')).toBeFocused();
});

test('the ⋯ exports the note as its own menu does, into Documents/Eien/Exports', async ({
  page,
}) => {
  await withNotes(page);
  await titles(page).filter({ hasText: 'Ideas' }).click();
  await more(page).click();
  await menuItem(page, 'Export…').click();
  await expect(page.locator('.menu [role="menuitem"]')).toHaveText([
    'AO3 HTML…',
    'EPUB…',
    'Word (.docx)…',
  ]);
  await menuItem(page, 'EPUB…').click();
  await expect.poll(() => listOutside(page, 'Eien/Exports')).toEqual(['Ideas.epub']);
});

test('the ⋯ opens the settings', async ({ page }) => {
  await withNotes(page);
  await titles(page).filter({ hasText: 'Ideas' }).click();
  await more(page).click();
  await menuItem(page, 'Settings').click();
  await expect(page.locator('dialog[open]')).toBeVisible();
});

test('no three panes or two on a phone: always one at a time', async ({ page }) => {
  await withNotes(page);
  await back(page).click();
  await expect(page.locator('.sidebar__panes')).toBeHidden();
  // Two panes chosen (on a wider window, or another time): the phone still shows a folder's notes.
  await page.evaluate(() => window.eien.settings.set('layout.panes', 'two'));
  await page.locator('.sidebar').getByText('Fic', { exact: true }).click();
  await onlyShown(page, 'list');
  await expect(titles(page)).toHaveText(['Mend', 'Tear']);
});

test('turned sideways, wide enough for three panes, it shows them; upright again, one', async ({
  page,
}) => {
  await withNotes(page);
  await titles(page).filter({ hasText: 'Tear' }).click();
  await page.setViewportSize({ width: 915, height: 412 });
  for (const each of PANES) await expect(pane(page, each)).toBeVisible();
  await expect(back(page)).toBeHidden();
  await page.setViewportSize({ width: 412, height: 915 });
  await onlyShown(page, 'page');
});

test('a search from the tree shows what it finds there', async ({ page }) => {
  // The list is out of sight: the tree takes the results, as with two panes on the desktop.
  await withNotes(page);
  await back(page).click();
  await page.getByRole('searchbox').fill('scarf');
  await expect(page.locator('.sidebar').getByText('Tear')).toBeVisible();
  await onlyShown(page, 'sidebar');
  await page.locator('.sidebar').getByText('Tear').click();
  await onlyShown(page, 'page');
  await expect(page.locator('.title')).toHaveText('Tear');
});

test('a finger scrolls the list: touching never lifts a row', async ({ page }) => {
  await withNotes(page);
  const row = page.locator('.note-row').first();
  const box = await row.boundingBox();
  if (!box) throw new Error('no row');
  await row.evaluate(
    (element, at) => {
      const event = (type: string, y: number) =>
        new PointerEvent(type, {
          pointerType: 'touch',
          isPrimary: true,
          button: type === 'pointermove' ? -1 : 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX: at.x,
          clientY: y,
          bubbles: true,
        });
      element.dispatchEvent(event('pointerdown', at.y));
      for (let step = 1; step <= 6; step++)
        document.dispatchEvent(event('pointermove', at.y + step * 15));
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  await expect(page.locator('.is-lifted')).toHaveCount(0);
});

test('an outline card’s menu moves it, where a finger can’t drag it', async ({ page }) => {
  await withNotes(page);
  await putOutside(
    page,
    'Eien/Vault/Fic/.eien-folder.json',
    '{"book":{},"order":["Mend.md","Tear.md"]}',
  );
  await back(page).click();
  await page.locator('.sidebar').getByText('Fic', { exact: true }).click();
  await titles(page).filter({ hasText: 'Mend' }).click();
  await more(page).click();
  await menuItem(page, 'Outline cards').click();
  const card = page.locator('.card[data-path="Fic/Tear.md"]');
  await card.click({ button: 'right' });
  await menuItem(page, 'Move earlier').click();
  await expect
    .poll(
      async () =>
        JSON.parse((await readOutside(page, 'Eien/Vault/Fic/.eien-folder.json')) ?? '{}').order,
    )
    .toEqual(['Tear.md', 'Mend.md']);
});
