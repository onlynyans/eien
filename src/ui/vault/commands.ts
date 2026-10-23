// The menu bar's commands for an open vault (../../app/electron/menu.ts):
// a new note, search (the field in sight), the page's views and formats, and
// the panes — ⌘\ and ⌘⇧\ shut or open the sidebar and the list, ⌘1/⌘2/⌘3
// give one the keyboard, opening it first if it's shut (spec §4). Zoom is the
// window's (../app.ts).

import { SPRINT_MINUTES } from '../../core/counters';
import { formatCommand } from '../../core/format';
import type { ExportFormat, MenuCommand } from '../../platform/bridge';
import type { SearchField } from '../list/search-field';
import type { PaneLayout } from '../shell/panes';
import type { Sidebar } from '../sidebar/sidebar';
import type { PageParts } from './page-parts';
import type { Pages } from './pages';

export interface CommandContext {
  /** The page and its note's seals: the active page's. */
  readonly pages: Pages;
  readonly panes: PaneLayout;
  readonly sidebar: Sidebar;
  readonly list: HTMLElement;
  /** In the list's band, or the sidebar's (../list/search-field.ts). */
  readonly search: SearchField;
  newNote(): void;
  /** Draw the list: a shut one isn't kept drawn. */
  drawList(): Promise<void>;
  /** The counters, Copy as HTML, exports and outline cards (./page-parts.ts). */
  readonly parts: PageParts;
  /** File → Import Markdown Folder… (./importing.ts). */
  importFolder(): void;
}

export function runCommand(command: MenuCommand, ctx: CommandContext): void {
  const { panes, sidebar } = ctx;
  const { page, versions } = ctx.pages.active;
  if (command === 'new-note') ctx.newNote();
  else if (command === 'search') {
    // The field in sight: the list's, or, with no list, the sidebar's, opened first if it's shut.
    if (ctx.search.isIn(sidebar.searchSlot)) panes.open('sidebar');
    ctx.search.focus();
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
  } else if (command === 'focus:page') {
    // Pressed in a page while split: the other page.
    const inPage = ctx.pages.sides.some((side) =>
      side.page.element.contains(document.activeElement),
    );
    panes.openPage();
    if (inPage && ctx.pages.split) ctx.pages.focusOther();
    else page.focus();
  } else if (command === 'split') void ctx.pages.toggle();
  else if (command === 'split:swap') ctx.pages.swap();
  else if (command === 'seal') void versions.seal();
  else if (command === 'compare') void versions.cycleCompare();
  else if (command === 'versions') versions.showPanel(!versions.panelOpen);
  else if (command === 'copy-html') void ctx.parts.htmlCopy.copy();
  else if (command === 'export-html') void ctx.parts.exports.openNote('html');
  else if (command.startsWith('export-note:')) {
    void ctx.parts.exports.openNote(command.slice('export-note:'.length) as ExportFormat);
  } else if (command.startsWith('export-book:')) {
    void ctx.parts.exports.currentBook(command.slice('export-book:'.length) as ExportFormat);
  } else if (command === 'import-folder') ctx.importFolder();
  else if (command === 'outline') void ctx.parts.outline.toggle();
  else if (command === 'sprint:stop') ctx.parts.counters.stopSprint();
  else if (command.startsWith('sprint:')) {
    const minutes = Number(command.slice('sprint:'.length));
    const known = SPRINT_MINUTES.find((each) => each === minutes);
    if (known) ctx.parts.counters.startSprint(known);
  } else if (command.startsWith('format:') && !ctx.parts.outline.open) {
    // Formats act on the page: never on one the outline cards are hiding.
    const format = formatCommand(command.slice('format:'.length));
    if (format) page.editor.format(format);
  }
}

/** The list's open note, or its first row, or (an empty list) its first control. */
export function focusList(list: HTMLElement): void {
  const rows = [...list.querySelectorAll<HTMLElement>('.note-row')];
  const target =
    rows.find((row) => row.getAttribute('aria-current') === 'true') ??
    rows[0] ??
    list.querySelector<HTMLElement>('button');
  target?.focus();
}
