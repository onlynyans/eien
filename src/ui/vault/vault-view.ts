// An open vault's three panes — the sidebar, the note list and the page —
// kept in step with each other and with the disk. The file operations are
// in ./organize.ts, the panes' widths and shutting in ../shell/panes.ts;
// this wires the panes, menus and drags to them.

import { freeNoteName, joinPath, VAULT_CONFIG } from '../../core/paths';
import type { Bridge } from '../../platform/bridge';
import { h } from '../dom';
import { watchDrags } from '../list/drag';
import { listKey, rememberSort } from '../list/sorts';
import type { SettingsState } from '../settings/settings-state';
import { PaneLayout, paneKeys } from '../shell/panes';
import { Sidebar } from '../sidebar/sidebar';
import { runCommand } from './commands';
import { onDiskChanges, touches } from './disk-changes';
import { type MenuContext, showFolderMenu, showNoteMenu } from './menus';
import { Navigation } from './navigation';
import { notePage } from './note-page';
import { Notice } from './notice';
import { oneAtATime } from './one-at-a-time';
import { OpenNote } from './open-note';
import { Organizer } from './organize';
import { pageParts } from './page-parts';
import { PaneDrawer } from './pane-drawer';
import { type Selection, VaultState } from './vault-state';

export interface ShownVault {
  /** Save whatever is unsaved. */
  flush(): Promise<void>;
  /** Save, and stop following the vault. */
  stop(): Promise<void>;
}

/** Show the vault named `name` in `root`. */
export async function showVault(
  root: HTMLElement,
  bridge: Bridge,
  name: string,
  settings: SettingsState,
  openSettings: () => void,
): Promise<ShownVault> {
  const state = new VaultState(bridge.vault, name);
  const trashName = bridge.platform === 'win32' ? 'the Recycle Bin' : 'the trash';
  const keys = paneKeys(bridge.platform === 'darwin');
  const nav = new Navigation();
  const notice = new Notice(() => void redraw());
  const tell = (message: string) => notice.tell(message);

  const organizer = new Organizer({
    vault: bridge.vault,
    state,
    trashName,
    session: () => note.session,
    closed: () => note.close(),
    freeze: (frozen) => page.editor.setLocked(frozen),
    tell,
  });

  const choose = (next: Selection) => {
    nav.choose(next);
    sidebar.clearSearch();
    void redraw();
  };

  const rowActions = {
    open: (path: string) => void openNote(path),
    menu: (path: string, at: { x: number; y: number }, ordered: boolean) =>
      showNoteMenu(menus, path, at, ordered),
    nudge: (path: string, by: -1 | 1) => void act(() => organizer.nudge(path, by)),
    rename: (path: string) => void renameNote(path),
    trash: (path: string) => void act(() => organizer.trash(path)),
  };

  const sidebar = new Sidebar(
    name,
    {
      ...rowActions,
      select: (next) => {
        if (!panes.two) return choose(next);
        nav.chooseAndToggle(next);
        sidebar.clearSearch();
        void redraw();
      },
      toggle: (id) => {
        nav.toggle(id);
        void draw.sidebar();
      },
      search: (words) => {
        nav.query = words;
        void redraw();
      },
      folderMenu: (path, at) => void showFolderMenu(menus, path, at),
      newFolder: () => void newFolder(nav.selection.kind === 'folder' ? nav.selection.path : ''),
      renameFolder: (path, typed) =>
        void act(async () => {
          const to = await organizer.renameFolder(path, typed);
          // Where it is now: under the name the disk took (cleaned, or refused and kept).
          sidebar.refocusOn(to ?? path);
          if (to) nav.follow(path, to);
        }),
      scheme: (scheme) => void settings.set('appearance.scheme', scheme).catch(console.error),
      panes: (two) => void settings.set('layout.panes', two ? 'two' : 'three').catch(console.error),
      settings: openSettings,
      toggleSidebar: () => panes.toggle('sidebar'),
    },
    keys.sidebar,
  );
  const list = h('section', { class: 'list', attrs: { 'aria-label': 'Notes' } });
  const pageArea = h('main', { class: 'page' });
  const shell = h('div', { class: 'shell' }, sidebar.element, list, pageArea);
  root.replaceChildren(shell);
  const page = notePage(pageArea, {
    note: () => note,
    state,
    organizer,
    openNote: (path) => void openNote(path),
    act: (operation) => void act(operation),
  });
  const panes = new PaneLayout(
    {
      shell,
      sidebar: sidebar.element,
      list,
      keys,
      leave: () => page.focus(),
      changed: () => void redraw(),
    },
    settings.values['layout.panes'] === 'two',
  );
  page.lead(panes.controls);

  const menus: MenuContext = {
    state,
    organizer,
    vaultName: name,
    trashName,
    act: (operation) => void act(operation),
    renameNote: (path) => void renameNote(path),
    newNote: (folder) => {
      choose({ kind: 'folder', path: folder });
      void newNote(folder);
    },
    newFolder: (parent) => void newFolder(parent),
    editFolder: (path) => editFolder(path),
    followFolder: (from, to) => nav.follow(from, to),
    unselect: (path) => nav.unselect(path),
  };

  const note = new OpenNote(bridge.vault, page, () => void refresh());
  const parts = pageParts({
    page,
    note,
    state,
    bridge,
    settings,
    nav,
    organizer,
    mac: keys.sidebar.startsWith('⌘'),
    tell,
    act: (operation) => act(operation),
    openNote: (path) => void openNote(path),
  });

  const drags = {
    moveTo: (path: string, folder: string) =>
      void act(() => organizer.moveInto(path, folder, true)),
    placeBefore: (path: string, before: string | null) =>
      void act(() => organizer.placeBefore(path, before)),
  };
  watchDrags(list, { ...drags, orderable: () => draw.listOrdered });
  watchDrags(sidebar.element, { ...drags, orderable: () => false }, '.tree-row__name[data-path]');

  // Run a file operation, then read the vault again and redraw: one at a time, each after the
  // last one's refresh, so two quick drags never work from a list that doesn't show the first.
  const act = oneAtATime(async () => {
    // The open note may have moved, or been renamed: the page names it, and finds its images, there.
    note.followMove();
    await refresh();
  });

  const draw = new PaneDrawer({
    state,
    nav,
    panes,
    settings,
    sidebar,
    list,
    notice,
    openNote: () => note.path,
    pageNews: (text) => page.news(text),
    listActions: {
      ...rowActions,
      newNote: () => void newNote(),
      clearSearch: () => {
        nav.query = '';
        sidebar.clearSearch();
        void redraw();
      },
      sort: (sort) => {
        rememberSort(listKey(nav.selection), sort);
        void redraw();
      },
    },
  });
  const redraw = () => {
    parts.sync();
    return draw.all();
  };

  /** Rename a note: open it, and its title becomes a field. */
  async function renameNote(path: string): Promise<void> {
    if (note.path !== path) await openNote(path);
    page.editTitle();
  }

  async function newFolder(parent: string): Promise<void> {
    const path = await organizer.newFolder(parent);
    if (!path) return;
    nav.openTo(parent);
    await refresh();
    editFolder(path);
  }

  /** Rename a folder in place: in the sidebar, opened first if it's shut (a menu can outlive it). */
  function editFolder(path: string): void {
    panes.open('sidebar');
    sidebar.editFolder(path);
  }

  async function openNote(path: string): Promise<void> {
    await note.open(path);
    await redraw();
  }

  async function newNote(into?: string): Promise<void> {
    const folder = into ?? nav.folder;
    const path = joinPath(folder, freeNoteName('Untitled', state.namesIn(folder)));
    const created = await bridge.vault.write(path, '', null);
    if (!created.ok) return; // something took the name meanwhile; the next refresh shows it
    nav.openTo(folder); // with two panes, the new note shows where it was made
    await state.refresh();
    await openNote(path);
    page.focus();
  }

  const refresh = () => state.refresh().then(redraw);

  const stopWatching = onDiskChanges(bridge.vault, (changed) => {
    if (note.path && touches(note.path, changed)) void note.session?.diskChanged();
    if (changed.has(VAULT_CONFIG)) void settings.reload(); // changed on another device
    parts.diskChanged(changed); // another device sealed the open note
    void refresh();
  });

  const stopSettings = settings.onChange((values, before) => {
    panes.setTwo(values['layout.panes'] === 'two'); // redraws when it changes
    if (
      values['books.numerals'] !== before['books.numerals'] ||
      values['appearance.scheme'] !== before['appearance.scheme']
    ) {
      void redraw();
    }
  });

  const onBlur = () => void note.flush();
  window.addEventListener('blur', onBlur);
  const onMenu = bridge.onMenu((command) =>
    runCommand(command, {
      page,
      panes,
      sidebar,
      list,
      newNote: () => void newNote(),
      drawList: () => draw.list(),
      parts,
    }),
  );
  await refresh();
  return {
    flush: () => note.flush(),
    stop: async () => {
      await note.flush();
      stopWatching();
      stopSettings();
      onMenu();
      panes.stop();
      notice.stop();
      parts.stop();
      window.removeEventListener('blur', onBlur);
    },
  };
}
