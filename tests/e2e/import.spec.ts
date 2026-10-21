// Phase 11 on the real app (spec §8): File → Import Markdown Folder… copies
// a folder of notes from elsewhere into a new folder in the vault, never
// writing over anything and never touching the original; the sidebar shows
// it, one line says how many came in, and a dialog lists what didn't.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, expect, test } from './launch';

test.use({ vaultFiles: { 'Drafts/Mine.md': 'My own words.' } });

const notice = (page: Page) => page.locator('.list__notice');

/** The folder dialog answered with `folder` (or cancelled); a message box's words kept in globalThis.boxes. */
async function choose(app: ElectronApplication, folder: string | null): Promise<void> {
  await app.evaluate(({ dialog }, folder) => {
    const boxes: { message?: string; detail?: string }[] = [];
    const seen = globalThis as { boxes?: typeof boxes; asked?: number };
    seen.boxes = boxes;
    seen.asked = 0;
    dialog.showOpenDialog = (async () => {
      seen.asked = (seen.asked ?? 0) + 1;
      return folder ? { canceled: false, filePaths: [folder] } : { canceled: true, filePaths: [] };
    }) as typeof dialog.showOpenDialog;
    dialog.showMessageBox = (async (
      _window: unknown,
      options: { message?: string; detail?: string },
    ) => {
      boxes.push({ message: options.message, detail: options.detail });
      return { response: 0, checkboxChecked: false };
    }) as typeof dialog.showMessageBox;
  }, folder);
}

const boxes = (app: ElectronApplication) =>
  app.evaluate(
    () => (globalThis as { boxes?: { message?: string; detail?: string }[] }).boxes ?? [],
  );

function put(root: string, files: Record<string, string | Uint8Array>): void {
  for (const [path, data] of Object.entries(files)) {
    const file = join(root, ...path.split('/'));
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, data);
  }
}

test.describe('import', () => {
  let base: string;
  test.beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'eien-import-'));
  });
  test.afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  test('a folder’s notes come in, numbered beside the vault’s own; the rest are listed', async ({
    app,
    page,
    vault,
  }) => {
    const source = join(base, 'Drafts');
    put(source, {
      'Ideas.md': '# Ideas\n\nOne.',
      'Old.txt': 'Plain text.',
      'Part/Chapter.markdown': 'Chapter words.',
      'photo.png': new Uint8Array([137, 80, 78, 71]),
      '.obsidian/app.json': '{}',
    });
    await choose(app, source);
    await expect(page.locator('.note-row').first()).toBeVisible();
    await clickMenu(app, 'File', 'Import Markdown Folder…');
    await expect(notice(page)).toHaveText(
      'Imported 3 notes into “Drafts 2”. 1 file didn’t come in.',
    );
    // The new folder is shown, its notes listed.
    await expect(page.locator('.list__heading')).toHaveText('Drafts 2');
    // Newest first, and they were written together: in either order.
    await expect(page.locator('.note-row__title')).toHaveCount(2);
    expect((await page.locator('.note-row__title').allTextContents()).sort()).toEqual([
      'Ideas',
      'Old',
    ]);
    expect(readFileSync(join(vault ?? '', 'Drafts 2/Part/Chapter.md'), 'utf8')).toBe(
      'Chapter words.',
    );
    expect(readFileSync(join(vault ?? '', 'Drafts/Mine.md'), 'utf8')).toBe('My own words.');
    expect(existsSync(join(vault ?? '', 'Drafts 2/.obsidian'))).toBe(false);
    expect(readFileSync(join(source, 'Ideas.md'), 'utf8')).toBe('# Ideas\n\nOne.'); // the original stays
    expect(await boxes(app)).toEqual([
      { message: '1 file didn’t come in.', detail: 'photo.png: not a note' },
    ]);
  });

  test('the vault itself is refused, and a cancel imports nothing', async ({
    app,
    page,
    vault,
  }) => {
    await expect(page.locator('.note-row').first()).toBeVisible();
    await choose(app, vault);
    await clickMenu(app, 'File', 'Import Markdown Folder…');
    await expect(notice(page)).toHaveText(
      'It couldn’t be imported: That folder is the vault, is in it, or holds it.',
    );
    await choose(app, null);
    await clickMenu(app, 'File', 'Import Markdown Folder…');
    await expect.poll(() => app.evaluate(() => (globalThis as { asked?: number }).asked)).toBe(1);
    await expect(notice(page)).toHaveText(/couldn’t be imported/u); // the last news, not a new one
    expect(readdirSync(vault ?? '')).toEqual(['Drafts']);
  });

  test('a folder with no notes makes nothing, and says so', async ({ app, page, vault }) => {
    const source = join(base, 'Pictures');
    put(source, { 'a.png': 'png', 'b.jpg': 'jpg' });
    await choose(app, source);
    await expect(page.locator('.note-row').first()).toBeVisible();
    await clickMenu(app, 'File', 'Import Markdown Folder…');
    await expect(notice(page)).toHaveText(
      'Nothing imported: no notes there. 2 files didn’t come in.',
    );
    expect(existsSync(join(vault ?? '', 'Pictures'))).toBe(false);
  });
});
