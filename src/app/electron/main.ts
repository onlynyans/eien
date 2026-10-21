import { app, BrowserWindow, dialog, Menu, session } from 'electron';
import { CHANNEL } from '../../platform/bridge';
import { dataFolder, prepareDataFolder, thisCopy } from './data-folders';
import { buildMenu, checkToggles } from './menu';
import { applyScheme, deviceSettings } from './settings-session';
import { createMainWindow } from './window';

// Tests and separate copies (EIEN_USER_DATA), and a portable copy, keep their
// data in their own folder, so they never share settings or the
// single-instance lock with the installed one (./data-folders.ts).
const userData = dataFolder(thisCopy());
const unwritable = userData === null ? null : prepareDataFolder(userData);
if (userData !== null && unwritable === null) app.setPath('userData', userData);

if (unwritable !== null) {
  dialog.showErrorBox('Eien can’t keep its data here', unwritable);
  app.exit(1);
} else if (!app.requestSingleInstanceLock()) {
  // One Eien at a time: a second launch focuses the first window instead.
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
    await createMainWindow(settings);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void deviceSettings().then(createMainWindow);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || quitting) app.quit();
  });
}
