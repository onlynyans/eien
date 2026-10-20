// An open vault's three panes — the sidebar, the note list and the page —
// kept in step with each other and with the disk.

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
import { type NoteImages, noteImages } from '../editor/image-loader';
import { renderList } from '../list/list';
import { NoteSession } from '../notes/note-session';
import { PageView } from '../page/page';
import type { SettingsState } from '../settings/settings-state';
import { Sidebar } from '../sidebar/sidebar';
import { type Selection, VaultState } from './vault-state';

/** Changes from disk arrive in bursts; the panes redraw once they settle. */
const REDRAW_AFTER_MS = 150;

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
  let selection: Selection = { kind: 'all' };
  /** The search field's words; while there are any, the list shows what matches. */
  let query = '';
  const open = new Set<string>();
  let session: NoteSession | null = null;

  const sidebar = new Sidebar(name, {
    select: (next) => {
      selection = next;
      query = '';
      sidebar.clearSearch();
      if (next.kind === 'folder') open.add(next.path);
      void redraw();
    },
    toggle: (id) => {
      if (!open.delete(id)) open.add(id);
      drawSidebar();
    },
    search: (words) => {
      query = words;
      void drawList();
    },
    scheme: (scheme) => void settings.set('appearance.scheme', scheme).catch(console.error),
    settings: openSettings,
  });
  const list = h('section', { class: 'list', attrs: { 'aria-label': 'Notes' } });
  const pageArea = h('main', { class: 'page' });
  root.replaceChildren(h('div', { class: 'shell' }, sidebar.element, list, pageArea));
  let images: NoteImages | null = null;
  const page = new PageView(pageArea, {
    changed: (text) => session?.edit(text),
    follow: (target) => {
      if (target.kind === 'url')
        window.open(target.value); // the main process opens web addresses in the browser
      else {
        const path = state.findByTitle(target.value);
        if (path) void openNote(path);
      }
    },
  });

  const crumbsOf = (path: string) => parentOf(path).split('/').filter(Boolean).join(' / ');

  const drawSidebar = () =>
    sidebar.draw({
      tree: state.tree,
      tags: state.tags,
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
      : await state.notesFor(selection, settings.values['books.numerals']);
    if (turn !== drawn) return;
    renderList(list, notes, session?.path ?? null, {
      open: (path) => void openNote(path),
      newNote: () => void newNote(),
      clearSearch: () => {
        query = '';
        sidebar.clearSearch();
        void drawList();
      },
    });
  };

  const redraw = async () => {
    drawSidebar();
    await drawList();
  };

  async function openNote(path: string): Promise<void> {
    await session?.flush();
    session = await NoteSession.open(bridge.vault, path, {
      status: (saveState) => page.state(saveState),
      replaced: (text) => page.replaceText(text),
      movedToCopy: (copy, from) => {
        page.retitle(titleOf(baseName(copy)), crumbsOf(copy));
        page.notice(
          `“${titleOf(baseName(from))}” changed elsewhere. Your version is kept beside it as “${titleOf(baseName(copy))}”.`,
        );
        void refresh();
      },
      gone: () => {
        session = null;
        page.showNothing();
      },
    });
    images?.release();
    images = session ? noteImages(parentOf(path), (file) => bridge.vault.readBytes(file)) : null;
    if (session && images) {
      page.show({
        crumbs: crumbsOf(path),
        title: session.title,
        text: session.text,
        loadImage: images.load,
      });
    } else page.showNothing();
    await drawList();
  }

  async function newNote(): Promise<void> {
    const folder = selection.kind === 'folder' && !query ? selection.path : '';
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

  let pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopWatching = bridge.vault.onChange((paths) => {
    for (const path of paths) pending.add(path);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const changed = pending;
      pending = new Set();
      // The note, or a folder it's in (renamed or removed elsewhere): look again.
      // Composed, as a watcher may report a name in the other Unicode form.
      const open = session?.path.normalize('NFC');
      if (
        session &&
        open &&
        [...changed].some((changedPath) => {
          const path = changedPath.normalize('NFC');
          return open === path || open.startsWith(`${path}/`);
        })
      ) {
        void session.diskChanged();
      }
      if (changed.has(VAULT_CONFIG)) void settings.reload(); // changed on another device
      void refresh();
    }, REDRAW_AFTER_MS);
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

  const onBlur = () => void session?.flush();
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
      await session?.flush();
    },
    stop: async () => {
      await session?.flush();
      stopWatching();
      stopSettings();
      onMenu();
      clearTimeout(timer);
      window.removeEventListener('blur', onBlur);
    },
  };
}
