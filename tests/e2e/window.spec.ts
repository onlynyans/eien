// The window: it opens, shows Eien, and holds the security line from spec §5.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron } from '@playwright/test';
import { appEnv, closeApp, expect, ROOT, test } from './launch';

test('opens one window, welcoming the writer when no vault is open', async ({ app, page }) => {
  await expect(page).toHaveTitle('Eien');
  await expect(page.locator('.welcome__name')).toHaveText('Eien');
  expect(app.windows()).toHaveLength(1);
});

test('the page loads with no console errors', async ({ page }) => {
  // Listen from the first line of a fresh load.
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.reload({ waitUntil: 'load' });
  expect(errors).toEqual([]);
});

test('the window has no Node', async ({ page }) => {
  const globals = await page.evaluate(() =>
    ['require', 'process', 'module', 'Buffer', 'global'].filter((name) => name in globalThis),
  );
  expect(globals).toEqual([]);
});

test('the window runs sandboxed', async ({ app, page }) => {
  test.skip(process.platform === 'linux', 'Electron reports sandboxing on macOS and Windows only');
  // The window's process exists once its page has loaded.
  await expect(page.locator('.welcome__name')).toBeVisible();
  const sandboxed = await app.evaluate(({ app, BrowserWindow }) => {
    const pid = BrowserWindow.getAllWindows()[0]?.webContents.getOSProcessId();
    return app.getAppMetrics().find((process) => process.pid === pid)?.sandboxed;
  });
  expect(sandboxed).toBe(true);
});

test('the bridge exposes only its own calls, and the page cannot change them', async ({ page }) => {
  const bridge = await page.evaluate(() => {
    const eien = window.eien as unknown as Record<string, unknown>;
    const vault = eien.vault as Record<string, unknown>;
    try {
      eien.platform = 'tampered';
      eien.extra = () => 'injected';
      vault.read = () => 'replaced';
    } catch {
      // A frozen bridge may throw in strict code; either way nothing may change.
    }
    return {
      keys: Object.keys(eien).sort(),
      vault: Object.keys(vault).sort(),
      settings: Object.keys(eien.settings as Record<string, unknown>).sort(),
      platform: eien.platform,
      readIsOurs: vault.read !== undefined && String(vault.read).includes('replaced') === false,
    };
  });
  expect(bridge).toEqual({
    keys: ['onBeforeClose', 'onMenu', 'platform', 'settings', 'vault'],
    vault: [
      'choose',
      'current',
      'list',
      'makeFolder',
      'move',
      'notes',
      'onChange',
      'read',
      'readBytes',
      'search',
      'trash',
      'write',
    ],
    settings: ['read', 'set'],
    platform: process.platform,
    readIsOurs: true,
  });
  await expect(page.locator('html')).toHaveAttribute('data-platform', process.platform);
});

test('the content security policy blocks inline scripts, eval and remote content', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const violations: string[] = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      violations.push(e.effectiveDirective),
    );

    const script = document.createElement('script');
    script.textContent = 'window.inlineRan = true';
    document.body.append(script);

    // Playwright's own evaluate may use eval, so try it from a timer, as the
    // page itself would.
    const evalRan = await new Promise<boolean>((done) =>
      setTimeout(() => {
        try {
          done(new Function('return true')() as boolean);
        } catch {
          done(false);
        }
      }),
    );

    const image = document.createElement('img');
    image.src = 'https://example.com/pixel.png';
    document.body.append(image);

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'https://example.com/style.css';
    document.head.append(style);

    await new Promise((r) => setTimeout(r, 300));
    return {
      inlineRan: 'inlineRan' in window,
      evalRan,
      violations: [...new Set(violations)].sort(),
    };
  });
  expect(result).toEqual({
    inlineRan: false,
    evalRan: false,
    violations: ['img-src', 'script-src-elem', 'script-src', 'style-src-elem'].sort(),
  });
});

test.describe('navigation', () => {
  // Record what would open in the system browser instead of opening it.
  test.beforeEach(async ({ app }) => {
    await app.evaluate(({ shell }) => {
      const opened: string[] = [];
      (globalThis as { opened?: string[] }).opened = opened;
      shell.openExternal = async (url: string) => {
        opened.push(url);
      };
    });
  });

  const opened = (app: import('@playwright/test').ElectronApplication) =>
    app.evaluate(() => (globalThis as { opened?: string[] }).opened ?? []);

  test('a web link leaves the window alone and opens in the browser', async ({ app, page }) => {
    const before = page.url();
    await page.evaluate(() => {
      window.location.href = 'https://example.com/';
    });
    await expect.poll(() => opened(app)).toEqual(['https://example.com/']);
    expect(page.url()).toBe(before);
  });

  test('window.open never makes a window', async ({ app, page }) => {
    await page.evaluate(() => window.open('https://example.com/new'));
    await expect.poll(() => opened(app)).toEqual(['https://example.com/new']);
    expect(app.windows()).toHaveLength(1);
  });

  test('a local file is neither shown nor opened', async ({ app, page }) => {
    const before = page.url();
    await page.evaluate(() => {
      window.location.href = 'file:///etc/hosts';
    });
    await page.waitForTimeout(500);
    expect(page.url()).toBe(before);
    expect(await opened(app)).toEqual([]);
  });
});

test('every permission request is refused', async ({ page }) => {
  expect(await page.evaluate(() => Notification.requestPermission())).toBe('denied');
});

test('a second launch exits and leaves the first window in place', async ({
  app,
  page,
  userData,
}) => {
  await expect(page.locator('.welcome__name')).toBeVisible();
  const electronPath = await app.evaluate(() => process.execPath);
  const exitCode = await new Promise<number | null>((done) => {
    const second = spawn(electronPath, [ROOT], { cwd: ROOT, env: appEnv(userData) });
    // A second copy that stays open has failed; stop it rather than hang the run.
    const stop = setTimeout(() => second.kill(), 10_000);
    second.on('exit', (code) => {
      clearTimeout(stop);
      done(code);
    });
  });
  expect(exitCode).toBe(0);
  expect(app.windows()).toHaveLength(1);
});

test('separate data folders run side by side', async ({ app, page }) => {
  await expect(page.locator('.welcome__name')).toBeVisible();
  const otherData = mkdtempSync(join(tmpdir(), 'eien-e2e-'));
  const other = await _electron.launch({ args: [ROOT], cwd: ROOT, env: appEnv(otherData) });
  try {
    await expect((await other.firstWindow()).locator('.welcome__name')).toHaveText('Eien');
    expect(app.windows()).toHaveLength(1);
  } finally {
    await closeApp(other);
    rmSync(otherData, { recursive: true, force: true });
  }
});
