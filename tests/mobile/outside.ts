// What the phone-page tests share: files put and read "from outside"
// through Capacitor's Filesystem itself, as Syncthing would on the phone;
// the list's titles; and the page opened, its vault shown.

import { expect, type Page } from '@playwright/test';

/** The Filesystem plugin's calls these tests make, as the page registered it. */
interface FilesystemCalls {
  writeFile(options: object): Promise<unknown>;
  readFile(options: object): Promise<{ data: string }>;
  readdir(options: object): Promise<{ files: { name: string }[] }>;
}

declare global {
  interface Window {
    Capacitor: { Plugins: { Filesystem: FilesystemCalls } };
  }
}

const DOCUMENTS = 'DOCUMENTS';

/** Write a file in Documents as another app would (Syncthing bringing a note from another device). */
export const putOutside = (page: Page, path: string, text: string) =>
  page.evaluate(
    ([path, data, directory]) =>
      window.Capacitor.Plugins.Filesystem.writeFile({
        path,
        data,
        directory,
        encoding: 'utf8',
        recursive: true,
      }),
    [path, text, DOCUMENTS] as const,
  );

/** A file's text in Documents, or null. */
export const readOutside = (page: Page, path: string) =>
  page.evaluate(
    ([path, directory]) =>
      window.Capacitor.Plugins.Filesystem.readFile({ path, directory, encoding: 'utf8' }).then(
        (file) => file.data,
        () => null,
      ),
    [path, DOCUMENTS] as const,
  );

/** The names in a folder in Documents. */
export const listOutside = (page: Page, path: string) =>
  page.evaluate(
    ([path, directory]) =>
      window.Capacitor.Plugins.Filesystem.readdir({ path, directory }).then(
        (listing) => listing.files.map((file) => file.name).sort(),
        () => [],
      ),
    [path, DOCUMENTS] as const,
  );

export const titles = (page: Page) => page.locator('.note-row__title');

export async function open(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.shell')).toBeVisible();
}
