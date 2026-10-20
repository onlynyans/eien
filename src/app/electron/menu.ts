import { app, Menu, type MenuItemConstructorOptions } from 'electron';
import { acceleratorOf, FORMAT_COMMANDS, type FormatCommandId } from '../../core/format';
import type { MenuCommand } from '../../platform/bridge';

/** Where the Format menu draws its lines: inline marks, then the link, then line formats. */
const FORMAT_GROUPS: readonly (readonly FormatCommandId[])[] = [
  ['bold', 'italic', 'underline', 'strike', 'highlight'],
  ['link'],
  ['heading1', 'heading2', 'heading3', 'quote'],
  ['bullet', 'numbered', 'checklist'],
];

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
    {
      label: 'Format',
      // The editor's own command list: the menu, the keys and the selection bar can't disagree.
      submenu: FORMAT_GROUPS.flatMap((group, i) => [
        ...(i > 0 ? [{ type: 'separator' } as const] : []),
        ...group.map((id): MenuItemConstructorOptions => {
          const command = FORMAT_COMMANDS.find((c) => c.id === id);
          return {
            label: command?.label ?? id,
            accelerator: command ? acceleratorOf(command.key) : undefined,
            click: () => send(`format:${id}`),
          };
        }),
      ]),
    },
    {
      label: 'View',
      submenu: [
        { label: 'Live', click: () => send('view:live') },
        { label: 'Source', click: () => send('view:source') },
        { label: 'Reading', click: () => send('view:reading') },
        { type: 'separator' },
        { label: 'Next View', accelerator: 'CmdOrCtrl+E', click: () => send('view:next') },
      ],
    },
    // A reload would drop the last moment of typing, so it's for development only.
    ...(app.isPackaged ? [] : [DEVELOP]),
    { role: 'windowMenu' },
  ];
  return Menu.buildFromTemplate(template);
}
