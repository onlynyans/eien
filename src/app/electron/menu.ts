import { app, type BaseWindow, Menu, type MenuItemConstructorOptions } from 'electron';
import { type SettingValues, TOGGLES, type ToggleKey } from '../../core/config';
import { SPRINT_MINUTES } from '../../core/counters';
import { EXPORT_LABELS } from '../../core/export';
import { type FindCommandId, findKey } from '../../core/find';
import { acceleratorOf, FORMAT_COMMANDS, type FormatCommandId, keyOn } from '../../core/format';
import type { ExportFormat, MenuCommand } from '../../platform/bridge';

/** A note's or a book's exports, in the File menu's order (spec §8). */
const EXPORTS: readonly ExportFormat[] = ['epub', 'docx', 'pdf'];

/** Where the Format menu draws its lines: inline marks, the link, line formats, then a table. */
const FORMAT_GROUPS: readonly (readonly FormatCommandId[])[] = [
  ['bold', 'italic', 'underline', 'strike', 'highlight'],
  ['link'],
  ['heading1', 'heading2', 'heading3', 'quote'],
  ['bullet', 'numbered', 'checklist'],
  ['table'],
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
    id: command, // greyed by it (./menu-grey.ts)
    label,
    accelerator,
    click: (_item, window) => send(command, window),
  });
  /** A setting turned on and off: its check follows the setting (checkToggles), wherever it's changed. */
  const toggle = (
    label: string,
    key: ToggleKey,
    accelerator?: string,
  ): MenuItemConstructorOptions => ({
    id: `toggle:${key}`,
    type: 'checkbox',
    label,
    accelerator,
    click: (menuItem, window) => {
      // Electron flips the check before this runs: put it back. It follows the setting once
      // the setting is saved (checkToggles), and stays as it was when nothing could change it.
      menuItem.checked = !menuItem.checked;
      send(`toggle:${key}`, window);
    },
  });
  const settings = item('Settings…', 'settings', 'CmdOrCtrl+,');
  /** Find in the note: its words and keys are the find bar's own (core/find). */
  const find = (id: FindCommandId, label: string, command: MenuCommand) =>
    item(label, command, acceleratorOf(findKey(id, mac)));
  const template: MenuItemConstructorOptions[] = [
    ...(mac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              settings,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'File',
      submenu: [
        item('New Note', 'new-note', 'CmdOrCtrl+N'),
        // Another window, on this one's vault and note (spec §4).
        item('New Window', 'new-window', 'CmdOrCtrl+Shift+N'),
        // A seal keeps this version for good (spec §9); autosave keeps writing the note.
        item('Seal', 'seal', 'CmdOrCtrl+S'),
        item('Open Vault…', 'open-vault', 'CmdOrCtrl+O'),
        { type: 'separator' },
        item('Export HTML…', 'export-html'),
        // The open note, or the book it's a chapter of (or the book chosen), as a file (spec §8).
        {
          label: 'Export Note',
          submenu: EXPORTS.map((format) => item(EXPORT_LABELS[format], `export-note:${format}`)),
        },
        {
          label: 'Export Book',
          submenu: EXPORTS.map((format) => item(EXPORT_LABELS[format], `export-book:${format}`)),
        },
        { type: 'separator' },
        item('Import Markdown Folder…', 'import-folder'),
        { type: 'separator' },
        ...(mac ? [] : [settings, { type: 'separator' } as const]),
        // Eien's own close, on every system: the window saves first (and, split, closes a side).
        item('Close Window', 'close-window', 'CmdOrCtrl+W'),
        ...(mac ? [] : [{ role: 'quit' } as const]),
      ],
    },
    {
      label: 'Edit',
      // Cut, copy, paste, undo and select all: the editor needs them on macOS.
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(mac ? [{ role: 'pasteAndMatchStyle' } as const] : []),
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        // The note (or what's chosen in it) as plain HTML that story sites and editors take (spec §8).
        item('Copy as HTML', 'copy-html', 'CmdOrCtrl+Shift+C'),
        // macOS's own checker; elsewhere there's none without a download (spec §4).
        ...(mac
          ? [
              { type: 'separator' } as const,
              toggle('Check Spelling While Typing', 'editor.spellcheck'),
            ]
          : []),
        { type: 'separator' },
        // In the open note (spec §4, Find in the note); Search Notes looks through the vault.
        {
          label: 'Find',
          submenu: [
            find('find', 'Find…', 'find'),
            find('replace', 'Find and Replace…', 'find:replace'),
            find('next', 'Find Next', 'find:next'),
            find('previous', 'Find Previous', 'find:previous'),
          ],
        },
        item('Search Notes…', 'search', 'CmdOrCtrl+Shift+F'),
      ],
    },
    {
      label: 'Format',
      // The editor's own command list: the menu, the keys and the selection bar can't disagree.
      submenu: FORMAT_GROUPS.flatMap((group, i) => [
        ...(i > 0 ? [{ type: 'separator' } as const] : []),
        ...group.map((id): MenuItemConstructorOptions => {
          const command = FORMAT_COMMANDS.find((c) => c.id === id);
          return item(
            command?.label ?? id,
            `format:${id}`,
            command && acceleratorOf(keyOn(command, mac)),
          );
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
        { type: 'separator' },
        // The writing tools (spec §4), this device's settings.
        toggle('Focus Mode', 'editor.focus', 'CmdOrCtrl+Shift+Return'),
        toggle('Typewriter Scrolling', 'editor.typewriter'),
        toggle('Show Markdown Marks', 'editor.marks'),
        toggle('Formatting Bar', 'editor.formatBar', 'CmdOrCtrl+Shift+B'),
        // The page's look, in a popover (#49): its key is the Look control's (ui/chrome/commands.ts).
        item('Look…', 'look', 'CmdOrCtrl+Shift+L'),
        { type: 'separator' },
        // A sprint against the clock, counted in the colophon (spec §4).
        {
          label: 'Start Sprint',
          submenu: SPRINT_MINUTES.map((minutes) => item(`${minutes} Minutes`, `sprint:${minutes}`)),
        },
        item('Stop Sprint', 'sprint:stop'),
        { type: 'separator' },
        // A book's chapters as cards in the page's place (spec §4).
        item('Outline Cards', 'outline', 'CmdOrCtrl+Shift+O'),
        { type: 'separator' },
        item('Compare', 'compare', 'CmdOrCtrl+Shift+D'),
        item('Versions', 'versions'),
        { type: 'separator' },
        // Shut or open a pane, and give one the keyboard (spec §4).
        item('Toggle Sidebar', 'panes:sidebar', 'CmdOrCtrl+\\'),
        item('Toggle Note List', 'panes:list', 'CmdOrCtrl+Shift+\\'),
        item('Go to Sidebar', 'focus:sidebar', 'CmdOrCtrl+1'),
        item('Go to Note List', 'focus:list', 'CmdOrCtrl+2'),
        item('Go to Page', 'focus:page', 'CmdOrCtrl+3'),
        { type: 'separator' },
        // Two notes side by side (spec §4): the note beside itself, or, split, the other page closed.
        item('Split Page', 'split', 'CmdOrCtrl+D'),
        item('Swap Pages', 'split:swap'),
        { type: 'separator' },
        // With the keyboard in the page, the page's zoom; elsewhere the whole window's (spec §4).
        item('Zoom In', 'zoom:in', 'CmdOrCtrl+='),
        // ⌘+ with Shift, as well as ⌘=: no id of its own, as ids are one per item.
        { ...item('Zoom In', 'zoom:in', 'CmdOrCtrl+Plus'), id: undefined, visible: false },
        item('Zoom Out', 'zoom:out', 'CmdOrCtrl+-'),
        item('Actual Size', 'zoom:reset', 'CmdOrCtrl+0'),
      ],
    },
    // A reload would drop the last moment of typing, so it's for development only.
    ...(app.isPackaged ? [] : [DEVELOP]),
    { role: 'windowMenu' },
  ];
  return Menu.buildFromTemplate(template);
}

/** The menu's checks as the settings have them. */
export function checkToggles(values: SettingValues): void {
  const menu = Menu.getApplicationMenu();
  for (const key of TOGGLES) {
    const item = menu?.getMenuItemById(`toggle:${key}`);
    if (item) item.checked = values[key] === 'on';
  }
}
