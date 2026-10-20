import { app, Menu, type MenuItemConstructorOptions } from 'electron';
import type { MenuCommand } from '../../platform/bridge';

const DEVELOP: MenuItemConstructorOptions = {
  label: 'Develop',
  submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }],
};

/** The menu bar. Commands the window acts on are sent to it with `send`. */
export function buildMenu(send: (command: MenuCommand) => void): Menu {
  const mac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(mac ? [{ role: 'appMenu' } as const] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Note', accelerator: 'CmdOrCtrl+N', click: () => send('new-note') },
        { label: 'Open Vault…', accelerator: 'CmdOrCtrl+O', click: () => send('open-vault') },
        { type: 'separator' },
        mac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    // Cut, copy, paste, undo and select all: the editor needs them on macOS.
    { role: 'editMenu' },
    // A reload would drop the last moment of typing, so it's for development only.
    ...(app.isPackaged ? [] : [DEVELOP]),
    { role: 'windowMenu' },
  ];
  return Menu.buildFromTemplate(template);
}
