import { app, BrowserWindow, Menu, session } from 'electron';
import { CHANNEL } from '../../platform/bridge';
import { buildMenu, checkToggles } from './menu';
import { applyScheme, deviceSettings } from './settings-session';
import { createMainWindow } from './window';

// Tests, and anyone running a separate copy, give Eien its own data folder,
// so it never shares settings or the single-instance lock with the real one.
const userData = process.env.EIEN_USER_DATA;
if (userData) app.setPath('userData', userData);

// One Eien at a time: a second launch focuses the first window instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  // A window waits to save before it closes, which cancels a quit under way;
  // remember the quit so it goes ahead once the windows have closed.
  let quitting = false;
  app.on('before-quit', () => {
    quitting = true;
  });

  app.whenReady().then(async () => {
    // Eien needs no camera, microphone, location or notifications.
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, allow) =>
      allow(false),
    );
    // Spellcheck is macOS's own checker. Elsewhere Electron's would download dictionaries
    // from Google, so there it's off for good, whatever a field asks.
    session.defaultSession.setSpellCheckerEnabled(process.platform === 'darwin');
    Menu.setApplicationMenu(
      buildMenu((command, window) => {
        if (window instanceof BrowserWindow) window.webContents.send(CHANNEL.menu, command);
      }),
    );
    // Day or night is set before the window draws, so it never flashes the other.
    const settings = await deviceSettings();
    applyScheme(settings);
    checkToggles(settings);
    await createMainWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || quitting) app.quit();
  });
}
