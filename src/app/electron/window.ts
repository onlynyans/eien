import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, type IpcMainEvent, ipcMain, shell } from 'electron';
import type { SettingValues } from '../../core/config';
import { CHANNEL } from '../../platform/bridge';
import { serveContextMenu } from './context-menu';
import { frameOptions, serveFrame } from './frame';
import { serveImport } from './import-session';
import { serveMenuGrey } from './menu-grey';
import { isAppUrl, isExternalLink } from './navigation';
import { serveOut } from './out-session';
import { deviceSettings, serveSettings, zoomFactorOf } from './settings-session';
import { serveSwipe } from './swipe-session';
import { serveVault } from './vault-session';
import { serveWindow, type WindowPlace } from './window-session';

/** How long the window gets to save before it closes anyway. */
const SAVE_BEFORE_CLOSE_MS = 3000;

/** The page the window shows: the dev server while developing, else the
 * built file beside this script. */
function appUrl(): string {
  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (devServer) return devServer;
  return pathToFileURL(join(import.meta.dirname, '../renderer/index.html')).href;
}

/**
 * Linux shows the window's own icon (the installers give macOS's and Windows'
 * theirs): the seal, packed beside the app as resources/icon.png
 * (electron-builder.ts, extraResources) and in build/icons when run from source.
 */
const linuxIcon = () =>
  app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(import.meta.dirname, '../../build/icons/linux/512x512.png');

/**
 * A window, as this device's `settings` have it (its zoom, from the first
 * draw), on `place`: the vault and note it was asked for from another window
 * (New Window), or, at launch, the vault last opened.
 */
export async function createMainWindow(
  settings: SettingValues,
  place: WindowPlace = { vault: null, note: null },
): Promise<BrowserWindow> {
  const url = appUrl();
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    ...place.bounds,
    minWidth: 640,
    minHeight: 480,
    show: false,
    title: 'Eien',
    ...(process.platform === 'linux' ? { icon: linuxIcon() } : {}),
    ...frameOptions(process.platform, zoomFactorOf(settings)),
    webPreferences: {
      zoomFactor: zoomFactorOf(settings),
      preload: join(import.meta.dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      // macOS's own spellchecker, used only where the note asks for it (Settings → Editor).
      // Elsewhere Electron would download dictionaries from Google: none, so no spellcheck.
      spellcheck: process.platform === 'darwin',
    },
  });

  window.webContents.on('will-navigate', (event, target) => {
    if (isAppUrl(target, url)) return;
    event.preventDefault();
    if (isExternalLink(target)) void shell.openExternal(target);
  });
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isExternalLink(target)) void shell.openExternal(target);
    return { action: 'deny' };
  });

  saveBeforeClose(window);
  const vault = await serveVault(window, place.vault);
  serveWindow(window, vault, { note: place.note }, (next) => openWindow(next));
  serveSettings(window, vault);
  serveImport(window, vault);
  serveOut(window);
  serveContextMenu(window);
  serveFrame(window);
  serveMenuGrey(window);
  serveSwipe(window);
  window.once('ready-to-show', () => window.show());
  void window.loadURL(url);
  return window;
}

/** Another window, as this device's settings have it now. */
export async function openWindow(place?: WindowPlace): Promise<BrowserWindow> {
  return createMainWindow(await deviceSettings(), place);
}

/**
 * A close waits for the window to save what's typed (spec §3: on quitting),
 * for at most SAVE_BEFORE_CLOSE_MS; then the window closes either way.
 */
function saveBeforeClose(window: BrowserWindow): void {
  let saved = false;
  window.on('close', (event) => {
    if (saved) return;
    event.preventDefault();
    const finish = () => {
      if (saved) return;
      saved = true;
      clearTimeout(timer);
      ipcMain.removeListener(CHANNEL.closeReady, onReady);
      if (!window.isDestroyed()) window.close();
    };
    const onReady = (ready: IpcMainEvent) => {
      if (ready.sender === window.webContents) finish();
    };
    const timer = setTimeout(finish, SAVE_BEFORE_CLOSE_MS);
    ipcMain.on(CHANNEL.closeReady, onReady);
    window.webContents.send(CHANNEL.beforeClose);
  });
}
