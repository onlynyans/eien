// Phase 7 on the real app (spec §9): ⌘S seals the open note — its id in its
// front matter, a copy in .eien/versions — Compare shows the changes since,
// then the seal, then the draft; the versions panel compares, restores,
// names and deletes; seals follow a renamed note and survive a restart.

import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import {
  clickMenu,
  closeApp,
  editorContent,
  expect,
  fakeTrash,
  launchApp,
  readQuietly,
  test,
} from './launch';

test.use({
  vaultFiles: {
    'Needle.md': 'She found a needle in the sewing kit.\n',
    'Other.md': 'Another note.\n',
  },
});

const at = (vault: string | null, ...parts: string[]) => join(vault ?? '', ...parts);
/** '' while the file can't be read, so a poll tries again (./launch.ts). */
const read = (vault: string | null, path: string) => readQuietly(at(vault, ...path.split('/')));
/** The open note's id, from its front matter on disk. */
const idOf = (vault: string | null, path = 'Needle.md') =>
  /^---\nid: (\S+)\n---\n/.exec(read(vault, path))?.[1] ?? null;
const sealsOf = (vault: string | null, id: string | null) => {
  const folder = at(vault, '.eien', 'versions', id ?? '-');
  return existsSync(folder) ? readdirSync(folder).sort() : [];
};
const row = (page: Page, title: string) =>
  page
    .locator('.note-row')
    .filter({ has: page.locator('.note-row__title', { hasText: new RegExp(`^${title}$`) }) });
const sealLine = (page: Page) => page.locator('.seal-line');
const seal = (app: ElectronApplication) => clickMenu(app, 'File', 'Seal');
const compare = (app: ElectronApplication) => clickMenu(app, 'View', 'Compare');
/** The page's Compare control, which says what it shows in its tooltip. */
const compareButton = (page: Page) => page.locator('[data-command="compare"]');

async function typeAtEnd(page: Page, words: string): Promise<void> {
  // At the text's start: on a narrow window the versions panel lies over the page's middle.
  await editorContent(page).click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(words);
}

test('the menu has the keys: ⌘S seals, ⌘⇧D compares', async ({ app, page }) => {
  await expect(page.locator('.note-row').first()).toBeVisible();
  const items = await app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()?.items.flatMap((menu) =>
      (menu.submenu?.items ?? []).map((item) => [menu.label, item.label, item.accelerator ?? null]),
    ),
  );
  expect(items).toEqual(
    expect.arrayContaining([
      ['File', 'Seal', 'CmdOrCtrl+S'],
      ['View', 'Compare', 'CmdOrCtrl+Shift+D'],
      ['View', 'Versions', null],
    ]),
  );
});

test('⌘S seals the note: its id in its front matter, its words in .eien/versions', async ({
  app,
  page,
  vault,
}) => {
  await row(page, 'Needle').click();
  await expect(sealLine(page)).toHaveText('Not sealed yet');
  await seal(app);
  await expect(sealLine(page)).toHaveText('Sealed just now');
  await expect.poll(() => idOf(vault)).toMatch(/^[A-Z][0-9A-Z]{9}$/);
  const id = idOf(vault);
  expect(read(vault, 'Needle.md')).toBe(
    `---\nid: ${id}\n---\nShe found a needle in the sewing kit.\n`,
  );
  const [file] = sealsOf(vault, id);
  expect(file).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.md$/);
  expect(read(vault, `.eien/versions/${id}/${file}`)).toBe(read(vault, 'Needle.md'));
  // The id is Eien's bookkeeping: out of sight in Live, there in Source.
  await expect(editorContent(page)).not.toContainText('id:');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(editorContent(page)).toContainText(`id: ${id}`);
  await page.getByRole('button', { name: 'Live', exact: true }).click();

  await seal(app); // nothing new
  await expect(sealLine(page)).toHaveText('No changes since the last version');
  expect(sealsOf(vault, id)).toHaveLength(1);
});

test('typing at the very start of a sealed note never breaks its front matter', async ({
  app,
  page,
  vault,
}) => {
  await row(page, 'Needle').click();
  await seal(app);
  await expect.poll(() => idOf(vault)).not.toBeNull();
  const id = idOf(vault);
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('Then ');
  await expect
    .poll(() => read(vault, 'Needle.md'))
    .toBe(`---\nid: ${id}\n---\nThen She found a needle in the sewing kit.\n`);
});

test('Compare shows the changes since the seal, then the seal, then the draft; typing returns', async ({
  app,
  page,
}) => {
  await row(page, 'Needle').click();
  await seal(app);
  await expect(sealLine(page)).toHaveText('Sealed just now');
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('She found a bone needle in the kit.');

  await compare(app);
  await expect(page.locator('.sheet__state')).toContainText('Changes since the seal just now');
  await expect(page.locator('.compare del.diff')).toHaveText(['sewing']);
  await expect(page.locator('.compare ins.diff')).toHaveText(['bone']);
  await expect(page.locator('.legend')).toContainText('1 removed 1 added');
  await expect(editorContent(page)).toBeHidden();
  await expect(compareButton(page)).toHaveAttribute('data-tip', 'Compare · Changes');
  await expect(compareButton(page)).toHaveAttribute('aria-pressed', 'true');

  await compare(app);
  await expect(page.locator('.sheet__state')).toContainText('Sealed just now — read only');
  await expect(page.locator('.compare')).toHaveText('She found a needle in the sewing kit.');

  // Typing in it: the draft again, with the key there.
  await page.locator('.compare').focus();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('!');
  await expect(editorContent(page)).toBeVisible();
  await expect(editorContent(page)).toContainText('!');
  await expect(compareButton(page)).toHaveAttribute(
    'data-tip',
    'Compare with the last saved version',
  );
  await expect(compareButton(page)).toHaveAttribute('aria-pressed', 'false');
});

test('Compare can’t be used before the first seal', async ({ app, page }) => {
  await row(page, 'Needle').click();
  await expect(compareButton(page)).toBeDisabled();
  await expect(compareButton(page)).toHaveAttribute('data-tip', 'No versions to compare yet');
  await compare(app);
  await expect(sealLine(page)).toHaveText('Not sealed yet');
  await expect(editorContent(page)).toBeVisible();
});

test('the panel names, compares, restores and deletes seals', async ({ app, page, vault }) => {
  const trash = await fakeTrash(app);
  try {
    await row(page, 'Needle').click();
    await seal(app);
    await expect.poll(() => idOf(vault)).not.toBeNull();
    const id = idOf(vault);
    await typeAtEnd(page, ' Bone needles were warmer.');
    await page.getByRole('button', { name: 'Versions', exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'Versions' });
    await expect(panel).toBeVisible();
    await expect(panel.locator('.version__when')).toHaveText(['Draft · now', 'Sealed just now']);

    // Named in place.
    await panel.getByRole('button', { name: /^Name the seal/ }).click();
    await page.keyboard.type('before the bone needles');
    await page.keyboard.press('Enter');
    await expect(panel.locator('.version__name')).toHaveText('before the bone needles');
    await expect.poll(() => sealsOf(vault, id)[0]).toMatch(/Z--before the bone needles\.md$/);

    // Compared from the panel: Changes, against that seal.
    await panel.getByRole('button', { name: /^Compare the draft with/ }).click();
    await expect(page.locator('.sheet__state')).toContainText('“before the bone needles”');
    await expect(page.locator('.compare ins.diff')).toHaveText(['Bone needles were warmer.']);

    // Restored: the draft is sealed first, then the seal's words come back.
    await panel.getByRole('button', { name: /^Restore/ }).click();
    await expect(sealLine(page)).toHaveText('Restored. The previous draft was saved as a version');
    await expect.poll(() => sealsOf(vault, id)).toHaveLength(2);
    await expect
      .poll(() => read(vault, 'Needle.md'))
      .toBe(`---\nid: ${id}\n---\nShe found a needle in the sewing kit.\n`);
    await expect(editorContent(page)).not.toContainText('Bone needles');
    const drafts = sealsOf(vault, id).filter((file) => !file.includes('--'));
    expect(read(vault, `.eien/versions/${id}/${drafts[0]}`)).toContain('Bone needles were warmer.');

    // Deleted: to the system's trash, and the writer is told.
    await panel
      .getByRole('button', { name: /^Send “before the bone needles” to the trash/ })
      .click();
    await expect(page.locator('.list__notice')).toHaveText('The version was moved to the trash.');
    await expect
      .poll(() => readdirSync(trash))
      .toEqual([expect.stringMatching(/--before the bone needles\.md$/)]);
    await expect(panel.locator('.version__name')).toHaveCount(0);
  } finally {
    rmSync(trash, { recursive: true, force: true });
  }
});

test('seals follow a renamed note, and another device’s seal shows at once', async ({
  app,
  page,
  vault,
}) => {
  await row(page, 'Needle').click();
  await seal(app);
  await expect.poll(() => idOf(vault)).not.toBeNull();
  const id = idOf(vault);
  await page.locator('.title').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Bone Needle');
  await page.keyboard.press('Enter');
  await expect.poll(() => existsSync(at(vault, 'Bone Needle.md'))).toBe(true);
  await page.getByRole('button', { name: 'Versions', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Versions' });
  await expect(panel.locator('.version__when')).toHaveText(['Draft · now', 'Sealed just now']);

  // Sealed on the phone, synced in.
  const phone = `${new Date(Date.now() - 60_000).toISOString().slice(0, 19).replace(/:/g, '-')}Z--on the phone.md`;
  writeFileSync(
    at(vault, '.eien', 'versions', id ?? '-', phone),
    `---\nid: ${id}\n---\nTyped on the train.\n`,
  );
  await expect(panel.locator('.version__name')).toHaveText(['on the phone'], { timeout: 5000 });
});

test('Esc closes the versions panel and gives the page the keyboard', async ({ app, page }) => {
  await row(page, 'Needle').click();
  await seal(app);
  await page.getByRole('button', { name: 'Versions', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Versions' });
  await expect(panel).toBeVisible();
  await expect
    .poll(() => panel.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.locator('.cm-content')).toBeFocused();
});

test('Esc while naming a seal stops the naming, and leaves the panel open', async ({
  app,
  page,
}) => {
  await row(page, 'Needle').click();
  await seal(app);
  await page.getByRole('button', { name: 'Versions', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Versions' });
  await panel.getByRole('button', { name: 'Name' }).first().click();
  await page.keyboard.type('half a nam');
  await page.keyboard.press('Escape');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('seals are there after a restart', async ({ app, page, userData, vault }) => {
  await row(page, 'Needle').click();
  await seal(app);
  await expect.poll(() => idOf(vault)).not.toBeNull();
  await closeApp(app);
  const again = await launchApp(userData, vault);
  try {
    const page2 = await again.firstWindow();
    await row(page2, 'Needle').click();
    await expect(sealLine(page2)).toHaveText(/^Sealed (just now|\dm ago)$/);
    await expect(compareButton(page2)).toBeEnabled();
  } finally {
    await closeApp(again);
  }
});

test('a copied note gets its own id on its first seal, and keeps the seals made before', async ({
  app,
  page,
  vault,
}) => {
  await row(page, 'Needle').click();
  await seal(app);
  await expect.poll(() => idOf(vault)).not.toBeNull();
  const id = idOf(vault);
  writeFileSync(at(vault, 'Needle copy.md'), read(vault, 'Needle.md')); // duplicated in Finder
  await expect(row(page, 'Needle copy')).toBeVisible();
  await row(page, 'Needle copy').click();
  await typeAtEnd(page, ' A copy.');
  await seal(app);
  // A read that comes back empty finds no id: taken as the original's, so the poll tries again.
  await expect.poll(() => idOf(vault, 'Needle copy.md') ?? id).not.toBe(id);
  const copyId = idOf(vault, 'Needle copy.md');
  expect(copyId).toMatch(/^[A-Z]/);
  expect(sealsOf(vault, copyId)).toHaveLength(2); // the one before the copy, and its own
  expect(sealsOf(vault, id)).toHaveLength(1);
  expect(idOf(vault)).toBe(id);
});
