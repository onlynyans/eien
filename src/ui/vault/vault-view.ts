// An open vault's panes (the sidebar, the note list, the page pane) kept in step with each other
// and the disk: file operations in ./organize.ts, what the writer does to notes in
// ./note-actions.ts, the sidebar's actions in ./vault-sidebar.ts, the pages in ./pages.ts, what
// it follows in ./follow.ts, the panes' widths in ../shell/panes.ts, a phone's one at a time in
// ./phone-view.ts, the layout's controls in ./chrome-wiring.ts. This wires them together.

import type { Bridge } from '../../platform/bridge';
import { h } from '../dom';
import { SearchField } from '../list/search-field';
import type { MenuBus } from '../menu/menu-bus';
import type { SettingsState } from '../settings/settings-state';
import { PaneLayout, paneKeys } from '../shell/panes';
import { SyncStatus } from '../sidebar/sync-status';
import { vaultChrome } from './chrome-wiring';
import { follow } from './follow';
import { listLens } from './list-lens';
import { trashNameOn } from './menu-items';
import { Navigation } from './navigation';
import { noteActions } from './note-actions';
import { Notice } from './notice';
import { oneAtATime } from './one-at-a-time';
import { orderActions } from './order-actions';
import { Organizer } from './organize';
import { ownWrites } from './own-writes';
import { pageDrop } from './page-drop';
import { Pages, pagesHeld } from './pages';
import { PaneDrawer } from './pane-drawer';
import { phoneView } from './phone-view';
import { rowActions } from './row-actions';
import { vaultSidebar } from './vault-sidebar';
import { VaultState } from './vault-state';
import { nameWindow } from './window-name';

export interface ShownVault {
  /** Save whatever is unsaved. */
  flush(): Promise<void>;
  /** Save, and stop following the vault. */
  stop(): Promise<void>;
  /** The system's back (a phone's): whether it went back. */
  back(): boolean;
  /** The open note, or none. */
  notePath(): string | null;
  /** Show the note at `path`. */
  openNote(path: string): Promise<void>;
  /** Close the active page while the window is split: whether there was one to close. */
  closePage(): boolean;
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

  /** A note in a window of its own: the desktop's only. */
  const openInNewWindow = bridge.window
    ? (path: string) => void bridge.window?.open(path)
    : undefined;
  // The notes open on the pages are held still and kept in step as they move.
  const organizer = new Organizer({
    vault: bridge.vault,
    state,
    trashName,
    tell,
    ...pagesHeld(() => pages),
  });

  const lens = listLens({
    nav,
    search: () => search,
    state,
    settings,
    redraw: () => void redraw(),
  });
  const search = new SearchField((words) => {
    nav.query = words;
    void redraw();
  });

  // The sidebar's moves in your order (./order-actions.ts); `sidebar` and `draw` come after.
  const order = orderActions({
    state,
    organizer,
    nav,
    sidebar: () => sidebar,
    act: (operation) => act(operation),
    redrawTree: () => void draw.sidebar(),
  });

  const { rows, menus } = rowActions({
    state,
    organizer,
    nav,
    order,
    vaultName: name,
    trashName,
    openInNewWindow,
    phone: () => phone.stack.phone,
    actions: () => actions,
    exports: () => pages.parts.exports,
    choose: lens.choose,
    act: (operation) => act(operation),
  });

  const sidebar = vaultSidebar({
    name,
    keys: keys.sidebar,
    search,
    rows,
    nav,
    organizer,
    order,
    phone: () => phone,
    panes: () => panes,
    menus: () => menus,
    choose: lens.choose,
    redraw: () => void redraw(),
    drawTree: () => void draw.sidebar(),
    act: (operation) => act(operation),
    newFolder: (parent) => void actions.newFolder(parent),
  });
  // The sync status at the sidebar's foot: a note changed that this window didn't change.
  const sync = new SyncStatus(sidebar.foot.sync, syncthing);
  const stopSync = bridge.vault.onChange((paths, local) => {
    if (own.foreign(paths, local).length > 0) sync.changedElsewhere();
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
  const pages = new Pages({
    area: pageArea,
    vault: bridge.vault,
    out: bridge.out,
    state,
    nav,
    organizer,
    settings,
    mac: keys.sidebar.startsWith('⌘'),
    openNote: (path) => actions.openNote(path),
    act: (operation) => act(operation),
    tell,
    changed: () => chrome.refresh(),
    rearranged: () => void redraw(),
    refresh: () => void refresh(),
  });
  const { parts } = pages;
  const phone = phoneView({
    shell,
    list,
    menu,
    settings,
    parts: () => parts,
    sidebar,
    pages,
    changed: () => panes.relayout(),
  });
  const panes = new PaneLayout(
    {
      shell,
      sidebar: sidebar.element,
      list,
      leave: () => pages.active.page.focus(),
      changed: () => void redraw(),
      phone: () => phone.stack.shown,
      showPhone: (pane) => phone.stack.show(pane),
    },
    settings.values['layout.panes'] === 'two',
  );
  // Made before the page's parts, which tell it when a seal's controls change; drawn after.
  const chrome = vaultChrome({
    shell,
    pages,
    sidebar,
    panes,
    phone,
    settings,
    menu,
    mac: keys.sidebar.startsWith('⌘'),
    openInNewWindow,
  });
  chrome.mount();

  // Run a file operation, then read the vault again and redraw: one at a time, each after the
  // last one's refresh, so two quick drags never work from a list that doesn't show the first.
  const act = oneAtATime(async () => {
    // Open notes may have moved, or been renamed: their pages name them, and find their images, there.
    pages.followMoves();
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
    shown: () => pages.notes(),
    pageNews: (text) => pages.pane.news(text),
    listActions: { ...rows, ...lens.actions, newNote: () => void actions.newNote() },
    arrange: lens.arrange,
  });
  const redraw = () => {
    panes.stepAside(pages.split && pages.mode.listAside); // Tools that follow: the list makes room
    pages.sync();
    sync.draw();
    chrome.refresh();
    nameWindow(pages.active.note.path, name);
    return draw.all().then(() => phone.stack.rename());
  };

  const actions = noteActions({
    vault: bridge.vault,
    state,
    nav,
    organizer,
    pages,
    phone,
    panes,
    sidebar,
    act,
    refresh: () => refresh(),
    redraw,
    tell,
    sidebarKey: keys.sidebar,
  });

  const refresh = (changed?: Iterable<string>) => state.refresh(changed).then(redraw);

  const stopFollowing = follow({
    vault: bridge.vault,
    settings,
    panes,
    menu,
    refresh,
    redraw,
    organizer,
    tree: sidebar.element,
    dropFolder: (path, to) => order.dropFolder(path, to),
    placeNote: (path, before) => order.placeNote(path, before),
    pageDrop: pageDrop(pages, (path, beside) => void actions.openNote(path, beside)),
    folderDrags: () => settings.values['lists.arranging'] !== 'mode',
    act,
    listOrdered: () => draw.listOrdered,
    showFolder: (path) => lens.choose({ kind: 'folder', path }),
    tell,
    commands: {
      pages,
      panes,
      sidebar,
      list: listBody,
      search,
      newNote: () => void actions.newNote(),
      drawList: () => draw.list(),
      parts,
    },
  });
  await refresh();
  return {
    back: () => phone.back(),
    notePath: () => pages.active.note.path,
    closePage: () => pages.close(pages.active),
    openNote: (path) => actions.openNote(path),
    // The note's words first; then a seal or a move under way finishes (a quit waits for both).
    flush: async () => {
      await pages.flush();
      await act.idle();
    },
    stop: async () => {
      await pages.flush();
      stopFollowing();
      stopSync();
      chrome.stop();
      panes.stop();
      phone.stack.stop();
      notice.stop();
      pages.stop();
    },
  };
}
