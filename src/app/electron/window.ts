import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BrowserWindow, shell } from 'electron';
import { isAppUrl, isExternalLink } from './navigation';

/** The page the window shows: the dev server while developing, else the
 * built file beside this script. */
function appUrl(): string {
  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (devServer) return devServer;
  return pathToFileURL(join(import.meta.dirname, '../renderer/index.html')).href;
}

export function createMainWindow(): BrowserWindow {
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

  window.once('ready-to-show', () => window.show());
  void window.loadURL(url);
  return window;
}
