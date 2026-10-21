// The phone the Android tests drive: the first device adb lists (start the
// emulator first: docs/testing.md), with the debug APK installed. Playwright
// drives Eien's WebView; adb plays everything outside it — Syncthing putting
// files in Documents/Eien, Android's settings, the app sent to the background.

import {
  _android,
  type AndroidDevice,
  test as base,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';

export const PKG = 'io.github.onlynyans.eien';
export const VAULT = '/sdcard/Documents/Eien/Vault';
export const EXPORTS = '/sdcard/Documents/Eien/Exports';

const quoted = (path: string) => `'${path.replaceAll("'", "'\\''")}'`;

export const test = base.extend<object, { device: AndroidDevice }>({
  device: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright's fixtures take their dependencies so.
    async ({}, use) => {
      const [device] = await _android.devices();
      if (!device) throw new Error('No Android device: start the emulator (AGENTS.md).');
      // These tests delete Documents/Eien. On a writer's own phone, that's their vault.
      if ((await shell(device, 'getprop ro.kernel.qemu')).trim() !== '1')
        throw new Error(`${device.model()} isn't an emulator: the Android tests run only on one.`);
      await use(device);
      await device.close();
    },
    { scope: 'worker' },
  ],
});

export { expect };

/** Run a shell command on the phone; its output. */
export const shell = async (device: AndroidDevice, command: string) =>
  (await device.shell(command)).toString('utf8');

/**
 * Start Eien and its page. Afresh (the default): no vault, no settings, as
 * just installed; with `keep`, as the writer left it. The access to the
 * shared Documents is given, or not.
 */
export async function startEien(
  device: AndroidDevice,
  { keep = false, allowed = true }: { keep?: boolean; allowed?: boolean } = {},
): Promise<Page> {
  await stopEien(device);
  if (!keep) {
    await shell(device, `pm clear ${PKG}`);
    // Eien's whole folder: the vault, the exports, and anything the old layout left.
    await shell(device, `rm -rf '/sdcard/Documents/Eien' '/sdcard/Documents/Eien Exports'`);
  }
  // For the app's uid as well: what Android's settings screen sets, which outranks the package's.
  const mode = allowed ? 'allow' : 'deny';
  await shell(device, `appops set --uid ${PKG} MANAGE_EXTERNAL_STORAGE ${mode}`);
  await shell(device, `appops set ${PKG} MANAGE_EXTERNAL_STORAGE ${mode}`);
  await shell(device, `am start -W -n ${PKG}/.MainActivity`);
  const page = await (await device.webView({ pkg: PKG })).page();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

/** End Eien, as Android does to an app in the background, and wait until its page is gone. */
export async function stopEien(device: AndroidDevice): Promise<void> {
  await shell(device, `am force-stop ${PKG}`);
  await expect.poll(() => device.webViews().filter((view) => view.pkg() === PKG).length).toBe(0);
}

/** A file's text on the phone, or null when there's none. */
export async function readOnPhone(device: AndroidDevice, path: string): Promise<string | null> {
  const out = await shell(device, `[ -f ${quoted(path)} ] && cat ${quoted(path)} || printf '\\0'`);
  return out === '\0' ? null : out;
}

/** Put a file on the phone as another app would (Syncthing bringing it from another device). */
export async function putOnPhone(device: AndroidDevice, path: string, text: string): Promise<void> {
  await shell(device, `mkdir -p ${quoted(path.slice(0, path.lastIndexOf('/')))}`);
  await device.push(Buffer.from(text, 'utf8'), path);
}

/** The names in a folder on the phone, sorted; hidden ones too. */
export async function listOnPhone(device: AndroidDevice, folder: string): Promise<string[]> {
  // find, not ls: ls escapes a space in a name.
  const out = await shell(device, `find ${quoted(folder)} -mindepth 1 -maxdepth 1 2>/dev/null`);
  return out
    .split('\n')
    .filter((path) => path !== '')
    .map((path) => path.slice(folder.length + 1))
    .sort();
}

/** Where the WebView's top edge is on the screen, in device pixels (under the status bar). */
async function webViewTop(device: AndroidDevice): Promise<number> {
  await shell(device, 'uiautomator dump /sdcard/eien-ui.xml');
  const tree = await shell(device, 'cat /sdcard/eien-ui.xml');
  return Number(/class="android\.webkit\.WebView"[^>]*bounds="\[\d+,(\d+)\]/u.exec(tree)?.[1] ?? 0);
}

/** A finger held on `target`, as a writer's long press: Android makes it the page's contextmenu. */
export async function longPress(device: AndroidDevice, page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('Nothing in sight to press.');
  const ratio = await page.evaluate(() => devicePixelRatio);
  const top = await webViewTop(device);
  const x = Math.round((box.x + box.width / 2) * ratio);
  const y = Math.round(top + (box.y + box.height / 2) * ratio);
  await shell(device, `input swipe ${x} ${y} ${x} ${y} 900`);
}
