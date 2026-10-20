import { app, type BaseWindow, Menu, type MenuItemConstructorOptions } from 'electron';
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

/** Sends a command to the window a menu click was for (none when no window has focus). */
export type SendCommand = (command: MenuCommand, window: BaseWindow | undefined) => void;

/** The menu bar. Commands the window acts on are sent to it with `send`. */
export function buildMenu(send: SendCommand): Menu {
  const mac = process.platform === 'darwin';
  const item = (
    label: string,
    command: MenuCommand,
    accelerator?: string,
  ): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: (_item, window) => send(command, window),
  });
  const template: MenuItemConstructorOptions[] = [
    ...(mac ? [{ role: 'appMenu' } as const] : []),
    {
      label: 'File',
      submenu: [
        item('New Note', 'new-note', 'CmdOrCtrl+N'),
        item('Open Vault…', 'open-vault', 'CmdOrCtrl+O'),
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
          return item(command?.label ?? id, `format:${id}`, command && acceleratorOf(command.key));
        }),
      ]),
    },
    {
      label: 'View',
      submenu: [
        item('Live', 'view:live'),
        item('Source', 'view:source'),
        item('Reading', 'view:reading'),
        { type: 'separator' },
        item('Next View', 'view:next', 'CmdOrCtrl+E'),
      ],
    },
    // A reload would drop the last moment of typing, so it's for development only.
    ...(app.isPackaged ? [] : [DEVELOP]),
    { role: 'windowMenu' },
  ];
  return Menu.buildFromTemplate(template);
}
