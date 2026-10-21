// An open vault's panes (the sidebar, the note list, the page) kept in step with each other and
// the disk: file operations in ./organize.ts, what it follows in ./follow.ts, the panes' widths
// in ../shell/panes.ts, a phone's one at a time in ./phone-view.ts. This wires them together.

import { freeNoteName, joinPath } from '../../core/paths';
import type { Bridge } from '../../platform/bridge';
import { h } from '../dom';
import { SearchField } from '../list/search-field';
import { listKey, rememberSort } from '../list/sorts';
import type { MenuBus } from '../menu/menu-bus';
import type { SettingsState } from '../settings/settings-state';
import { PaneLayout, paneKeys } from '../shell/panes';
import { Sidebar } from '../sidebar/sidebar';
import { follow } from './follow';
import { type MenuContext, showFolderMenu, showNoteMenu, trashNameOn } from './menus';
import { Navigation } from './navigation';
import { notePage } from './note-page';
import { Notice } from './notice';
import { oneAtATime } from './one-at-a-time';
import { OpenNote } from './open-note';
import { Organizer } from './organize';
import { pageParts } from './page-parts';
import { PaneDrawer } from './pane-drawer';
import { phoneView } from './phone-view';
import { type Selection, VaultState } from './vault-state';

export interface ShownVault {
  /** Save whatever is unsaved. */
  flush(): Promise<void>;
  /** Save, and stop following the vault. */
  stop(): Promise<void>;
  /** The system's back (a phone's): whether it went back. */
  back(): boolean;
}

/** Show the vault named `name` in `root`. */
export async function showVault(
  root: HTMLElement,
  bridge: Bridge,
  name: string,
  settings: SettingsState,
  openSettings: () => void,
  menu: MenuBus,
): Promise<ShownVault> {
  const state = new VaultState(bridge.vault, name);
  const trashName = trashNameOn(bridge.platform);
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
    search.clear();
    void redraw();
  };
  const search = new SearchField((words) => {
    nav.query = words;
    void redraw();
  });

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
        phone.stack.show('list'); // on a phone, the notes chosen
        if (!panes.two) return choose(next);
        nav.chooseAndToggle(next);
        search.clear();
        void redraw();
      },
      toggle: (id) => {
        nav.toggle(id);
        void draw.sidebar();
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
    search,
  );
  const listSearch = h('div', { class: 'list__search' });
  const listBody = h('div', { class: 'list__body' });
  const list = h(
    'section',
    { class: 'list', attrs: { 'aria-label': 'Notes' } },
    listSearch,
    listBody,
  );
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
  const phone = phoneView({
    shell,
    list,
    menu,
    settings,
    parts: () => parts,
    sidebar,
    page,
    changed: () => panes.relayout(),
  });
  const panes = new PaneLayout(
    {
      shell,
      sidebar: sidebar.element,
      list,
      keys,
      leave: () => page.focus(),
      changed: () => void redraw(),
      phone: () => phone.stack.shown,
      showPhone: (pane) => phone.stack.show(pane),
    },
    settings.values['layout.panes'] === 'two',
  );
  page.lead(panes.controls);

  const menus: MenuContext = {
    state,
    organizer,
    get exports() {
      return parts.exports;
    },
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
    openNote: (path) => openNote(path),
  });

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
    list: listBody,
    placeSearch: (inList, name) => search.place(inList ? listSearch : sidebar.searchSlot, name),
    notice,
    openNote: () => note.path,
    pageNews: (text) => page.news(text),
    listActions: {
      ...rowActions,
      newNote: () => void newNote(),
      clearSearch: () => search.clearAndSearch(),
      sort: (sort) => {
        rememberSort(listKey(nav.selection), sort);
        void redraw();
      },
    },
  });
  const redraw = () => {
    parts.sync();
    return draw.all().then(() => phone.stack.rename());
  };

  /** Rename a note: open it, and its title becomes a field. */
  async function renameNote(path: string): Promise<void> {
    if (note.path !== path) await openNote(path);
    else phone.stack.show('page'); // on a phone, from the list: the title's on the page
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
    phone.stack.show('page');
  }

  async function newNote(into?: string): Promise<void> {
    const folder = into ?? nav.folder;
    const path = joinPath(folder, freeNoteName('Untitled', state.namesIn(folder)));
    const created = await bridge.vault.write(path, '', null);
    if (!created.ok) return; // something took the name meanwhile; the next refresh shows it
    nav.openTo(folder); // with two panes, the new note shows where it was made
    await state.refresh();
    await openNote(path);
    page.focus(true); // into the new note, to write
  }

  const refresh = (changed?: Iterable<string>) => state.refresh(changed).then(redraw);

  const stopFollowing = follow({
    vault: bridge.vault,
    note,
    settings,
    panes,
    menu,
    refresh,
    redraw,
    organizer,
    tree: sidebar.element,
    act,
    listOrdered: () => draw.listOrdered,
    showFolder: (path) => choose({ kind: 'folder', path }),
    tell,
    commands: {
      page,
      panes,
      sidebar,
      list: listBody,
      search,
      newNote: () => void newNote(),
      drawList: () => draw.list(),
      parts,
    },
  });
  await refresh();
  return {
    back: () => phone.back(),
    // The note's words first; then a seal or a move under way finishes (a quit waits for both).
    flush: async () => {
      await note.flush();
      await act.idle();
    },
    stop: async () => {
      await note.flush();
      stopFollowing();
      panes.stop();
      phone.stack.stop();
      notice.stop();
      parts.stop();
    },
  };
}
