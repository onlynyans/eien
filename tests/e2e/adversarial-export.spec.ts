// Adversarial: exports on the real app (spec §8). A note's own Export… reads
// a note that isn't open from the disk, as it's stored: here, as another app
// (Windows Notepad, some sync tools) saved it, with a byte-order mark before
// its front matter. "The front matter is never posted." Fails on the code as
// it stands.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication } from '@playwright/test';
import { expect, test } from './launch';

test.use({
  vaultFiles: {
    'Mending.md': '﻿---\r\nid: 01JB2X4Q7Z\r\ntags: [private]\r\n---\r\nShe mended the scarf.\r\n',
    'Fire.md': 'It burned.',
  },
});

/** The save dialog, answered with `file`. */
async function saveTo(app: ElectronApplication, file: string): Promise<void> {
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = (async () => ({
      canceled: false,
      filePath: file,
    })) as unknown as typeof dialog.showSaveDialog;
  }, file);
}

test.describe('a note’s Export…, for a note that isn’t open', () => {
  let out: string;
  test.beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), 'eien-out-'));
  });
  test.afterEach(() => {
    rmSync(out, { recursive: true, force: true });
  });

  test('HTML never holds the front matter of a note saved with a byte-order mark', async ({
    app,
    page,
  }) => {
    const file = join(out, 'Mending.html');
    await saveTo(app, file);
    await page.locator('.note-row', { hasText: 'Fire' }).click(); // another note open
    await page.locator('.note-row', { hasText: 'Mending' }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Export…' }).click();
    await page.getByRole('menuitem', { name: 'HTML…' }).click();
    await expect(page.locator('.list__notice')).toHaveText('Saved as “Mending.html”.');
    const html = readFileSync(file, 'utf8');
    expect(html).toContain('She mended the scarf.');
    expect(html).not.toContain('01JB2X4Q7Z');
    expect(html).not.toContain('private');
  });
});
