import { app, BrowserWindow, session } from 'electron';
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

  app.whenReady().then(() => {
    // Eien needs no camera, microphone, location or notifications.
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, allow) =>
      allow(false),
    );
    createMainWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
