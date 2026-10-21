// An open vault's panes (the sidebar, the note list, the page) kept in step with each other and
// the disk: file operations in ./organize.ts, what it follows in ./follow.ts, the panes' widths
// in ../shell/panes.ts, a phone's one at a time in ./phone-view.ts, the layout's controls in
// ./chrome-wiring.ts. This wires them together.

import { freeNoteName, joinPath } from '../../core/paths';
import type { Bridge } from '../../platform/bridge';
import { h } from '../dom';
import { SearchField } from '../list/search-field';
import { listKey, rememberSort } from '../list/sorts';
import type { MenuBus } from '../menu/menu-bus';
import type { SettingsState } from '../settings/settings-state';
import { PaneLayout, paneKeys } from '../shell/panes';
import { Sidebar } from '../sidebar/sidebar';
import { SyncStatus } from '../sidebar/sync-status';
import { vaultChrome } from './chrome-wiring';
import { follow } from './follow';
import { type MenuContext, showFolderMenu, showNoteMenu, showTagMenu, trashNameOn } from './menus';
import { Navigation } from './navigation';
import { notePage } from './note-page';
import { Notice } from './notice';
import { oneAtATime } from './one-at-a-time';
import { OpenNote } from './open-note';
import { Organizer } from './organize';
import { ownWrites } from './own-writes';
import { pageParts } from './page-parts';
import { PaneDrawer } from './pane-drawer';
import { phoneView } from './phone-view';
import { renameInRow } from './rename-in-row';
import { type Selection, VaultState } from './vault-state';

export interface ShownVault {
  /** Save whatever is unsaved. */
  flush(): Promise<void>;
  /** Save, and stop following the vault. */
  stop(): Promise<void>;
  /** The system's back (a phone's): whether it went back. */
  back(): boolean;
}

/** Show the vault named `name` in `root`; `syncthing` when Syncthing syncs it (the sidebar's sync status). */
export async function showVault(
  root: HTMLElement,
  given: Bridge,
  name: string,
  settings: SettingsState,
  menu: MenuBus,
  syncthing = false,
): Promise<ShownVault> {
  // The vault, its writes remembered (./own-writes.ts): a change the disk reports that this
  // window didn't make came from elsewhere. The rest of the bridge as it is, methods and all.
  const own = ownWrites(given.vault);
  const bridge: Bridge = Object.create(given, { vault: { value: own.vault, enumerable: true } });
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
    rename: (path: string) => renameNote(path),
    pin: (path: string) => void act(() => organizer.pin(path, !state.pins.includes(path))),
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
      tagMenu: (key, at) => showTagMenu(menus, key, at),
      newTag: (tag) => void act(() => organizer.makeTag(tag, true)),
      newFolder: () => void newFolder(nav.selection.kind === 'folder' ? nav.selection.path : ''),
      renameFolder: (path, typed) =>
        void act(async () => {
          const to = await organizer.renameFolder(path, typed);
          // Where it is now: under the name the disk took (cleaned, or refused and kept).
          sidebar.refocusOn(to ?? path);
          if (to) nav.follow(path, to);
        }),
      toggleSidebar: () => panes.toggle('sidebar'),
    },
    keys.sidebar,
    search,
  );
  // The sync status at the sidebar's foot: a note changed that this window didn't change.
  const sync = new SyncStatus(sidebar.foot.sync, syncthing);
  const stopSync = bridge.vault.onChange((paths) => {
    if (own.foreign(paths).length > 0) sync.changedElsewhere();
  });
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
      leave: () => page.focus(),
      changed: () => void redraw(),
      phone: () => phone.stack.shown,
      showPhone: (pane) => phone.stack.show(pane),
    },
    settings.values['layout.panes'] === 'two',
  );
  // Made before the page's parts, which tell it when a seal's controls change; drawn after.
  const chrome = vaultChrome({
    shell,
    page,
    sidebar,
    panes,
    phone,
    settings,
    menu,
    mac: keys.sidebar.startsWith('⌘'),
    parts: () => parts,
  });

  const menus: MenuContext = {
    state,
    organizer,
    get exports() {
      return parts.exports;
    },
    vaultName: name,
    trashName,
    act: (operation) => void act(operation),
    renameNote: (path) => renameNote(path),
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
    changed: () => chrome.refresh(),
    act: (operation) => act(operation),
    openNote: (path) => openNote(path),
  });
  chrome.mount();

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
    sync.draw();
    chrome.refresh();
    return draw.all().then(() => phone.stack.rename());
  };

  /** Rename in the row the writer is at (./rename-in-row.ts); with none in sight, by the page's title. */
  function renameNote(path: string): void {
    // A phone, one pane at a time, keeps its rename on the page, where the title is in sight.
    if (phone.stack.phone) return void renameOnPage(path);
    renameInRow(path, {
      namesIn: (folder) => state.namesIn(folder),
      rename: (from, typed) => organizer.renameNote(from, typed),
      act,
      onPage: (at) => void renameOnPage(at),
    });
  }

  async function renameOnPage(path: string): Promise<void> {
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
      stopSync();
      chrome.stop();
      panes.stop();
      phone.stack.stop();
      notice.stop();
      parts.stop();
    },
  };
}
