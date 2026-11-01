// What the phone-page tests share: files put and read "from outside"
// through Capacitor's Filesystem itself, as Syncthing would on the phone;
// the list's titles; the page opened, its vault shown; Android's back; and a finger's swipe.

import { type CDPSession, expect, type Page } from '@playwright/test';

/** The Filesystem plugin's calls these tests make, as the page registered it. */
interface FilesystemCalls {
  writeFile(options: object): Promise<unknown>;
  readFile(options: object): Promise<{ data: string }>;
  readdir(options: object): Promise<{ files: { name: string }[] }>;
  deleteFile(options: object): Promise<unknown>;
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

/** Delete a file in Documents as another app would (Syncthing bringing a deletion from another device). */
export const removeOutside = (page: Page, path: string) =>
  page.evaluate(
    ([path, directory]) => window.Capacitor.Plugins.Filesystem.deleteFile({ path, directory }),
    [path, DOCUMENTS] as const,
  );

/** Write a file's bytes (given as base64) in Documents as another app would: an image. */
export const putBytesOutside = (page: Page, path: string, base64: string) =>
  page.evaluate(
    ([path, data, directory]) =>
      window.Capacitor.Plugins.Filesystem.writeFile({ path, data, directory, recursive: true }),
    [path, base64, DOCUMENTS] as const,
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

/**
 * Three panes, the note list between the tree and the page, in place of a phone's own two (#69):
 * for the tests of the list beside the page. One pane at a time, it changes nothing.
 */
export async function threePanes(page: Page): Promise<void> {
  await page.evaluate(() => window.eien.settings.set('layout.panes', 'three'));
  await page.reload(); // the settings as this device keeps them, read as the window starts
  await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'three');
}

export async function open(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.shell')).toBeVisible();
}

/** A file's bytes in Documents (the Filesystem gives them as base64), or null. */
export const bytesOutside = (page: Page, path: string) =>
  page.evaluate(
    ([path, directory]) =>
      window.Capacitor.Plugins.Filesystem.readFile({ path, directory }).then(
        (file) => [...atob(file.data)].map((char) => char.charCodeAt(0)),
        () => null,
      ),
    [path, DOCUMENTS] as const,
  );

interface WebPlugin {
  readonly listeners: Record<string, unknown[] | undefined>;
  notifyListeners(event: string, data: object): void;
}

/**
 * Catch Capacitor's web plugins as they're made, before the page loads, so
 * systemBack can reach the App plugin's back listener. On the web the
 * plugin's implementation is loaded lazily, and the preload's first listeners
 * race to load it: two instances are made, and the back listener isn't
 * always on the one the proxy keeps. So every instance is caught as it is
 * made, and the back goes to whichever holds a listener for it.
 */
export const catchBackButton = (page: Page) =>
  page.addInitScript(() => {
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

/** Android's back button or gesture (catchBackButton first). */
export const systemBack = (page: Page) =>
  page.evaluate(() => {
    const plugins = (window as unknown as { __webPlugins: WebPlugin[] }).__webPlugins;
    const holding = plugins.filter((plugin) => (plugin.listeners?.backButton?.length ?? 0) > 0);
    if (holding.length === 0) throw new Error('nothing listens for the back button');
    for (const plugin of holding) plugin.notifyListeners('backButton', { canGoBack: false });
  });

/** One finger down at `from`, drawn to `to` in `steps`, and lifted: the browser's own touch (CDP's). */
export async function swipe(
  cdp: CDPSession,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps: number,
): Promise<void> {
  const point = (x: number, y: number) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point(from.x, from.y),
  });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x, y) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
