// The menu bar's commands for an open vault (../../app/electron/menu.ts):
// a new note, search, the page's views and formats, and the panes — ⌘\ and
// ⌘⇧\ shut or open the sidebar and the list, ⌘1/⌘2/⌘3 give one the keyboard,
// opening it first if it's shut (spec §4). Zoom is the window's (../app.ts).

import { formatCommand } from '../../core/format';
import type { MenuCommand } from '../../platform/bridge';
import type { PageView } from '../page/page';
import type { PaneLayout } from '../shell/panes';
import type { Sidebar } from '../sidebar/sidebar';

export interface CommandContext {
  readonly page: PageView;
  readonly panes: PaneLayout;
  readonly sidebar: Sidebar;
  readonly list: HTMLElement;
  newNote(): void;
  /** Draw the list: a shut one isn't kept drawn. */
  drawList(): Promise<void>;
}

export function runCommand(command: MenuCommand, ctx: CommandContext): void {
  const { page, panes, sidebar } = ctx;
  if (command === 'new-note') ctx.newNote();
  else if (command === 'search') {
    panes.open('sidebar');
    sidebar.focusSearch();
  } else if (command === 'view:next') page.nextMode();
  else if (command === 'view:live' || command === 'view:source' || command === 'view:reading') {
    page.setMode(command.slice('view:'.length) as 'live' | 'source' | 'reading');
  } else if (command === 'panes:sidebar') panes.toggle('sidebar');
  else if (command === 'panes:list') panes.toggle('list');
  else if (command === 'focus:sidebar') {
    panes.open('sidebar');
    sidebar.focusTree();
  } else if (command === 'focus:list') {
    // With two panes there's no list: the second pane is the page.
    const wasShut = panes.isShut('list');
    if (!panes.open('list')) page.focus();
    else if (!wasShut) focusList(ctx.list);
    else void ctx.drawList().then(() => focusList(ctx.list));
  } else if (command === 'focus:page') page.focus();
  else if (command.startsWith('format:')) {
    const format = formatCommand(command.slice('format:'.length));
    if (format) page.editor.format(format);
  }
}

/** The list's open note, or its first row, or (an empty list) its first control. */
function focusList(list: HTMLElement): void {
  const rows = [...list.querySelectorAll<HTMLElement>('.note-row')];
  const target =
    rows.find((row) => row.getAttribute('aria-current') === 'true') ??
    rows[0] ??
    list.querySelector<HTMLElement>('button');
  target?.focus();
}
