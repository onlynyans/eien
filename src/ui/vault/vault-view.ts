// An open vault's three panes — the sidebar, the note list and the page —
// kept in step with each other and with the disk. The file operations are
// in ./organize.ts; this wires the panes, menus and drags to them.

import { formatCommand } from '../../core/format';
import {
  baseName,
  freeNoteName,
  joinPath,
  parentOf,
  titleOf,
  VAULT_CONFIG,
} from '../../core/paths';
import type { Bridge } from '../../platform/bridge';
import { h } from '../dom';
import { watchDrags } from '../list/drag';
import { renderList } from '../list/list';
import { listKey, rememberSort, sortFor } from '../list/sorts';
import { PageView } from '../page/page';
import type { SettingsState } from '../settings/settings-state';
import { Sidebar } from '../sidebar/sidebar';
import { onDiskChanges, touches } from './disk-changes';
import { type MenuContext, showFolderMenu, showNoteMenu } from './menus';
import { crumbsOf, OpenNote } from './open-note';
import { Organizer } from './organize';
import { type NoteList, type Selection, VaultState } from './vault-state';

/** How long a line of news stays above the list. */
const NOTICE_MS = 8000;

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
  let selection: Selection = { kind: 'all' };
  /** The search field's words; while there are any, the list shows what matches. */
  let query = '';
  const open = new Set<string>();
  let shown: NoteList | null = null;
  let notice: string | null = null;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  const tell = (message: string) => {
    notice = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice = null;
      void drawList();
    }, NOTICE_MS);
    void drawList();
  };

  const organizer = new Organizer({
    vault: bridge.vault,
    state,
    trashName,
    session: () => note.session,
    closed: () => note.close(),
    tell,
  });

  const choose = (next: Selection) => {
    selection = next;
    query = '';
    sidebar.clearSearch();
    if (next.kind === 'folder') {
      for (let folder = next.path; folder; folder = parentOf(folder)) open.add(folder);
    }
    void redraw();
  };

  /** After a rename or move: the open folders and the selection follow the folder to its new path. */
  const followFolder = (from: string, to: string) => {
    const moved = (path: string) =>
      path === from || path.startsWith(`${from}/`) ? to + path.slice(from.length) : path;
    for (const id of [...open]) {
      if (moved(id) !== id) {
        open.delete(id);
        open.add(moved(id));
      }
    }
    if (selection.kind === 'folder') selection = { kind: 'folder', path: moved(selection.path) };
  };

  const sidebar = new Sidebar(name, {
    select: choose,
    toggle: (id) => {
      if (!open.delete(id)) open.add(id);
      drawSidebar();
    },
    search: (words) => {
      query = words;
      void drawList();
    },
    folderMenu: (path, at) => void showFolderMenu(menus, path, at),
    newFolder: () => void newFolder(selection.kind === 'folder' ? selection.path : ''),
    renameFolder: (path, typed) =>
      void act(async () => {
        const to = await organizer.renameFolder(path, typed);
        if (to) followFolder(path, to);
      }),
    scheme: (scheme) => void settings.set('appearance.scheme', scheme).catch(console.error),
    settings: openSettings,
  });
  const list = h('section', { class: 'list', attrs: { 'aria-label': 'Notes' } });
  const pageArea = h('main', { class: 'page' });
  root.replaceChildren(h('div', { class: 'shell' }, sidebar.element, list, pageArea));
  const page = new PageView(pageArea, {
    changed: (text) => note.session?.edit(text),
    follow: (target) => {
      if (target.kind === 'url')
        window.open(target.value); // the main process opens web addresses in the browser
      else {
        const path = state.findByTitle(target.value);
        if (path) void openNote(path);
      }
    },
    rename: (typed) => {
      const path = note.path;
      if (!path) return;
      void act(async () => {
        const to = await organizer.renameNote(path, typed);
        page.retitle(titleOf(baseName(to ?? path)), crumbsOf(to ?? path));
        page.focus();
      });
    },
  });

  const menus: MenuContext = {
    state,
    organizer,
    vaultName: name,
    trashName,
    ordered: () => shown?.folder !== undefined && shown.sort === 'order' && !query,
    act: (operation) => void act(operation),
    renameNote: (path) => void renameNote(path),
    newNote: (folder) => {
      choose({ kind: 'folder', path: folder });
      void newNote(folder);
    },
    newFolder: (parent) => void newFolder(parent),
    editFolder: (path) => sidebar.editFolder(path),
    followFolder,
    unselect: (path) => {
      if (
        selection.kind === 'folder' &&
        (selection.path === path || selection.path.startsWith(`${path}/`))
      ) {
        selection = { kind: 'all' };
      }
    },
  };

  const note = new OpenNote(bridge.vault, page, () => void refresh());

  watchDrags(list, {
    orderable: () => shown?.folder !== undefined && shown.sort === 'order' && !query,
    moveTo: (path, folder) => void act(() => organizer.moveInto(path, folder, true)),
    placeBefore: (path, before) => void act(() => organizer.placeBefore(path, before)),
  });

  /** Run a file operation, then read the vault again and redraw. */
  async function act(operation: () => Promise<unknown>): Promise<void> {
    await operation();
    // The open note may have moved, or been renamed: the page names it where it is now.
    if (note.path) page.retitle(titleOf(baseName(note.path)), crumbsOf(note.path));
    await refresh();
  }

  const drawSidebar = () =>
    sidebar.draw({
      tree: state.tree,
      tags: state.tags,
      pinned: state.pins.length,
      selection,
      open,
      scheme: settings.values['appearance.scheme'],
    });

  /** Counts list draws, so a slow search can't overwrite a newer list. */
  let drawn = 0;
  const drawList = async () => {
    const turn = ++drawn;
    const words = query.trim();
    const notes = words
      ? await state.search(words)
      : await state.notesFor(
          selection,
          settings.values['books.numerals'],
          sortFor(listKey(selection)),
        );
    if (turn !== drawn) return;
    shown = notes;
    renderList(
      list,
      notes,
      note.path,
      {
        open: (path) => void openNote(path),
        newNote: () => void newNote(),
        clearSearch: () => {
          query = '';
          sidebar.clearSearch();
          void drawList();
        },
        sort: (sort) => {
          rememberSort(listKey(selection), sort);
          void drawList();
        },
        menu: (path, at) => showNoteMenu(menus, path, at),
        nudge: (path, by) => void act(() => organizer.nudge(path, by)),
        rename: (path) => void renameNote(path),
        trash: (path) => void act(() => organizer.trash(path)),
      },
      notice,
    );
  };

  const redraw = async () => {
    drawSidebar();
    await drawList();
  };

  /** Rename a note: open it, and its title becomes a field. */
  async function renameNote(path: string): Promise<void> {
    if (note.path !== path) await openNote(path);
    page.editTitle();
  }

  async function newFolder(parent: string): Promise<void> {
    const path = await organizer.newFolder(parent);
    if (!path) return;
    for (let folder = parent; folder; folder = parentOf(folder)) open.add(folder);
    await refresh();
    sidebar.editFolder(path);
  }

  async function openNote(path: string): Promise<void> {
    await note.open(path);
    await drawList();
  }

  async function newNote(into?: string): Promise<void> {
    const folder = into ?? (selection.kind === 'folder' && !query ? selection.path : '');
    const path = joinPath(folder, freeNoteName('Untitled', state.namesIn(folder)));
    const created = await bridge.vault.write(path, '', null);
    if (!created.ok) return; // something took the name meanwhile; the next refresh shows it
    await state.refresh();
    await openNote(path);
    page.focus();
  }

  const refresh = async () => {
    await state.refresh();
    await redraw();
  };

  const stopWatching = onDiskChanges(bridge.vault, (changed) => {
    if (note.path && touches(note.path, changed)) void note.session?.diskChanged();
    if (changed.has(VAULT_CONFIG)) void settings.reload(); // changed on another device
    void refresh();
  });

  page.showZoom(settings.values['page.zoom']);
  const stopSettings = settings.onChange((values, before) => {
    page.showZoom(values['page.zoom']);
    if (
      values['books.numerals'] !== before['books.numerals'] ||
      values['appearance.scheme'] !== before['appearance.scheme']
    ) {
      void redraw();
    }
  });

  const onBlur = () => void note.flush();
  window.addEventListener('blur', onBlur);
  const onMenu = bridge.onMenu((command) => {
    if (command === 'new-note') void newNote();
    else if (command === 'search') sidebar.focusSearch();
    else if (command === 'view:next') page.nextMode();
    else if (command === 'view:live' || command === 'view:source' || command === 'view:reading') {
      page.setMode(command.slice('view:'.length) as 'live' | 'source' | 'reading');
    } else if (command.startsWith('format:')) {
      const format = formatCommand(command.slice('format:'.length));
      if (format) page.editor.format(format);
    }
  });
  await refresh();
  return {
    flush: async () => {
      await note.flush();
    },
    stop: async () => {
      await note.flush();
      stopWatching();
      stopSettings();
      onMenu();
      clearTimeout(noticeTimer);
      window.removeEventListener('blur', onBlur);
    },
  };
}
