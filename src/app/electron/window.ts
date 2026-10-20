import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BrowserWindow, type IpcMainEvent, ipcMain, shell } from 'electron';
import { CHANNEL } from '../../platform/bridge';
import { isAppUrl, isExternalLink } from './navigation';
import { serveOut } from './out-session';
import { serveSettings } from './settings-session';
import { serveVault } from './vault-session';

/** How long the window gets to save before it closes anyway. */
const SAVE_BEFORE_CLOSE_MS = 3000;

/** The page the window shows: the dev server while developing, else the
 * built file beside this script. */
function appUrl(): string {
  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (devServer) return devServer;
  return pathToFileURL(join(import.meta.dirname, '../renderer/index.html')).href;
}

export async function createMainWindow(): Promise<BrowserWindow> {
  const url = appUrl();
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    show: false,
    title: 'Eien',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false,
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
  serveSettings(window, await serveVault(window));
  serveOut(window);
  window.once('ready-to-show', () => window.show());
  void window.loadURL(url);
  return window;
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
