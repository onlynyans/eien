// A note's own images on the real app (spec §2, §4): an image dropped on the
// page is copied into "<note>.assets" beside it and linked, and shows; the
// folder isn't a folder in the sidebar; renaming the note takes its images
// and its links with it.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { png } from '../support/images';
import { editorContent, expect, test } from './launch';

const NOTE = 'Chapter 3';

async function open(page: Page, title: string): Promise<void> {
  await page.locator('.note-row', { hasText: title }).first().click();
  await expect(page.locator('.title')).toHaveText(title);
}

/** Drop `bytes` on the page's last line as a file named `name`, as Finder or Explorer would. */
async function dropImage(page: Page, name: string, bytes: Uint8Array): Promise<void> {
  const target = page.locator('.cm-line').last();
  const box = await target.boundingBox();
  const dataTransfer = await page.evaluateHandle(
    ([name, bytes]) => {
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array(bytes)], name, { type: 'image/png' }));
      return data;
    },
    [name, [...bytes]] as const,
  );
  await target.dispatchEvent('drop', {
    dataTransfer,
    clientX: (box?.x ?? 0) + (box?.width ?? 0) - 2,
    clientY: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  });
}

const text = (vault: string | null, path: string) => {
  const file = join(vault ?? '', ...path.split('/'));
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
};

test.describe('an image dropped on a note', () => {
  test.use({ vaultFiles: { [`${NOTE}.md`]: 'A scarf, mended.\n\nThe end.' } });

  test('is copied beside it, linked, and shown', async ({ page, vault }) => {
    await open(page, NOTE);
    await dropImage(page, 'scarf.png', png(12, 8));
    const image = join(vault ?? '', `${NOTE}.assets`, 'scarf.png');
    await expect.poll(() => existsSync(image)).toBe(true);
    await expect
      .poll(() => text(vault, `${NOTE}.md`))
      .toContain('![](Chapter%203.assets/scarf.png)');
    // Away from its line, Live draws it.
    await page.locator('.cm-line', { hasText: 'A scarf, mended.' }).click();
    await expect(editorContent(page).locator('img.eien-image')).toBeVisible();
    // The folder is the note's, not one of the vault's.
    await expect(page.locator('.sidebar').getByText(`${NOTE}.assets`)).toHaveCount(0);
  });

  test('a second of the same name is numbered, the first left as it was', async ({
    page,
    vault,
  }) => {
    await open(page, NOTE);
    await dropImage(page, 'scarf.png', png(4, 4));
    await expect.poll(() => text(vault, `${NOTE}.md`)).toContain('scarf.png)');
    await dropImage(page, 'scarf.png', png(6, 6));
    await expect
      .poll(() => text(vault, `${NOTE}.md`))
      .toContain('![](Chapter%203.assets/scarf%202.png)');
    expect(readFileSync(join(vault ?? '', `${NOTE}.assets`, 'scarf.png'))).toEqual(
      Buffer.from(png(4, 4)),
    );
  });
});

test.describe('a note with images, renamed', () => {
  test.use({
    vaultFiles: {
      [`${NOTE}.md`]: 'A scarf.\n\n![](Chapter%203.assets/scarf.png)\n',
      [`${NOTE}.assets/scarf.png`]: png(8, 8),
    },
  });

  test('takes its images and its links with it', async ({ page, vault }) => {
    await open(page, NOTE);
    await page.locator('.title').click();
    await expect(page.locator('.title__field')).toBeFocused();
    await page.keyboard.type('The Fire');
    await page.keyboard.press('Enter');
    await expect
      .poll(() => existsSync(join(vault ?? '', 'The Fire.assets', 'scarf.png')))
      .toBe(true);
    expect(existsSync(join(vault ?? '', `${NOTE}.assets`))).toBe(false);
    await expect
      .poll(() => text(vault, 'The Fire.md'))
      .toBe('A scarf.\n\n![](The%20Fire.assets/scarf.png)\n');
    // The page still shows it, found under the new name.
    await page.locator('.cm-line', { hasText: 'A scarf.' }).click();
    await expect(editorContent(page).locator('img.eien-image')).toBeVisible();
  });
});
