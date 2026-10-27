// Hide tags and IDs (backlog #45; spec §4): the front matter's tags: and id:
// lines out of sight in Live, Source and Reading, kept in the file as they
// are through typing at the start, Select All and delete, find and replace,
// and a seal. Saves are waited for on the file itself, never on a time.

import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, editorContent, expect, readQuietly, test } from './launch';

const FRONT = '---\ntitle: Needle\ntags: [fic]\nid: CSHE541J35\n---\n';
const NOTE = `${FRONT}She found a fic in the sewing kit.\n`;
const TAGGED = '---\ntags: [fic]\n---\n';

test.use({
  vaultFiles: { 'Needle.md': NOTE, 'Tagged.md': `${TAGGED}A tagged note.\n` },
});

/** '' while the file can't be read, so a poll tries again (./launch.ts). */
const read = (vault: string | null, path: string) => readQuietly(join(vault ?? '', path));
const row = (page: Page, title: string) => page.locator('.note-row', { hasText: title });
const view = (page: Page, name: 'Live' | 'Source' | 'Reading') =>
  page.getByRole('button', { name, exact: true }).click();

/** Hide tags and IDs on or off, as the writer does it: Settings → Writing → Editor. */
async function hideTagsAndIds(page: Page, value: 'on' | 'off'): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('navigation').getByRole('button', { name: 'Editor', exact: true }).click();
  const group = dialog.getByRole('group', { name: 'Hide tags and IDs', exact: true });
  const choice = group.getByRole('button', { name: value === 'on' ? 'On' : 'Off', exact: true });
  await choice.click();
  await expect(choice).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

async function open(page: Page, title: string, words: string): Promise<void> {
  await row(page, title).click();
  await expect(editorContent(page)).toContainText(words);
}

test('the setting hides the lines in Live, Source and Reading; off, Source shows them', async ({
  page,
}) => {
  await open(page, 'Needle', 'She found');
  await view(page, 'Source');
  await expect(editorContent(page)).toContainText('tags: [fic]');
  await expect(editorContent(page)).toContainText('id: CSHE541J35');

  await hideTagsAndIds(page, 'on');
  for (const mode of ['Source', 'Live', 'Reading'] as const) {
    await view(page, mode);
    await expect(editorContent(page)).toContainText('She found');
    await expect(editorContent(page), mode).not.toContainText('tags:');
    await expect(editorContent(page), mode).not.toContainText('CSHE541J35');
  }
  await view(page, 'Source');
  // The writer's own key stays in sight; the tags still show on the page.
  await expect(editorContent(page)).toContainText('title: Needle');
  await expect(page.locator('.sheet__tags')).toContainText('fic');

  await hideTagsAndIds(page, 'off');
  await expect(editorContent(page)).toContainText('tags: [fic]');
  await expect(editorContent(page)).toContainText('id: CSHE541J35');
});

test.describe('with the setting on', () => {
  test.use({ deviceFile: { settings: { 'editor.hideTagsAndIds': 'on' } } });

  test('typing at the very start of the note goes after the hidden front matter', async ({
    page,
    vault,
  }) => {
    await open(page, 'Tagged', 'A tagged note.');
    await expect(editorContent(page)).not.toContainText('tags:');
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+Home');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Then ');
    await expect.poll(() => read(vault, 'Tagged.md')).toBe(`${TAGGED}Then A tagged note.\n`);
  });

  test('Select All and delete keeps the hidden lines in the file, and what’s typed follows them', async ({
    page,
    vault,
  }) => {
    await open(page, 'Needle', 'She found');
    await view(page, 'Source');
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await expect
      .poll(() => read(vault, 'Needle.md'))
      .toBe('---\n\ntags: [fic]\nid: CSHE541J35\n---\n');
    await page.keyboard.type('New words.');
    await expect
      .poll(() => read(vault, 'Needle.md'))
      .toBe('---\n\ntags: [fic]\nid: CSHE541J35\n---\nNew words.');
    await expect(editorContent(page)).not.toContainText('tags:');
  });

  test('find counts and replaces only the words in sight', async ({ app, page, vault }) => {
    await open(page, 'Needle', 'She found');
    await editorContent(page).click();
    await clickMenu(app, 'Edit', 'Find', 'Find and Replace…');
    const find = page.locator('.find');
    await expect(find.getByRole('textbox', { name: 'Find' })).toBeFocused();
    await page.keyboard.type('fic');
    await expect(find.getByRole('status')).toHaveText('1 of 1');
    await find.getByRole('textbox', { name: 'Replace' }).fill('thimble');
    await find.getByRole('button', { name: 'Replace all' }).click();
    await expect
      .poll(() => read(vault, 'Needle.md'))
      .toBe(`${FRONT}She found a thimble in the sewing kit.\n`);
  });

  test('a seal gives the note its id, out of sight, and leaves the tags as they are', async ({
    app,
    page,
    vault,
  }) => {
    await open(page, 'Tagged', 'A tagged note.');
    await seal(app);
    await expect(page.locator('.seal-line')).toHaveText('Sealed just now');
    await expect
      .poll(() => read(vault, 'Tagged.md'))
      .toMatch(/^---\nid: \w+\ntags: \[fic\]\n---\nA tagged note\.\n$/);
    await expect(editorContent(page)).not.toContainText('id:');
    await expect(editorContent(page)).not.toContainText('tags:');
  });
});

const seal = (app: ElectronApplication) => clickMenu(app, 'File', 'Seal');
