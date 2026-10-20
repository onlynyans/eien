// The window: a vault's three panes, kept in step with the disk.

import { formatCommand } from '../core/format';
import { baseName, freeNoteName, joinPath, parentOf, titleOf } from '../core/paths';
import type { Bridge } from '../platform/bridge';
import { h } from './dom';
import { renderList } from './list/list';
import { NoteSession } from './notes/note-session';
import { noteImages, type NoteImages } from './editor/image-loader';
import { PageView } from './page/page';
import { renderSidebar } from './sidebar/sidebar';
import { type Selection, VaultState } from './vault/vault-state';
import { renderWelcome } from './welcome/welcome';

/** Changes from disk arrive in bursts; the panes redraw once they settle. */
const REDRAW_AFTER_MS = 150;

interface ShownVault {
  /** Save whatever is unsaved. */
  flush(): Promise<void>;
  /** Save, and stop following the vault. */
  stop(): Promise<void>;
}

export async function startApp(root: HTMLElement, bridge: Bridge): Promise<void> {
  let shown: ShownVault | null = null;

  const open = async () => {
    await shown?.stop();
    shown = null;
    const info = await bridge.vault.current();
    if (info) shown = await showVault(root, bridge, info.name);
    else renderWelcome(root, chooseVault);
  };
  const chooseVault = async () => {
    const info = await bridge.vault.choose();
    if (info) await open();
  };

  bridge.onMenu((command) => {
    if (command === 'open-vault') void chooseVault();
  });
  bridge.onBeforeClose(async () => {
    await shown?.flush();
  });
  await open();
}

/** Show the vault named `name`. */
async function showVault(root: HTMLElement, bridge: Bridge, name: string): Promise<ShownVault> {
  const state = new VaultState(bridge.vault, name);
  let selection: Selection = { kind: 'all' };
  const openFolders = new Set<string>();
  let session: NoteSession | null = null;

  const sidebar = h('aside', { class: 'sidebar', attrs: { 'aria-label': 'Vault' } });
  const list = h('section', { class: 'list', attrs: { 'aria-label': 'Notes' } });
  const pageArea = h('main', { class: 'page' });
  root.replaceChildren(h('div', { class: 'shell' }, sidebar, list, pageArea));
  let images: NoteImages | null = null;
  const page = new PageView(pageArea, {
    changed: (text) => session?.edit(text),
    follow: (target) => {
      if (target.kind === 'url') window.open(target.value); // the main process opens web addresses in the browser
      else {
        const path = state.findByTitle(target.value);
        if (path) void openNote(path);
      }
    },
  });

  const crumbsOf = (path: string) => parentOf(path).split('/').filter(Boolean).join(' / ');

  const drawSidebar = () =>
    renderSidebar(
      sidebar,
      { name, tree: state.tree, selection, open: openFolders },
      {
        select: (next) => {
          selection = next;
          if (next.kind === 'folder') openFolders.add(next.path);
          void redraw();
        },
        toggle: (path) => {
          if (!openFolders.delete(path)) openFolders.add(path);
          drawSidebar();
        },
      },
    );

  const drawList = async () =>
    renderList(list, await state.notesFor(selection), session?.path ?? null, {
      open: (path) => void openNote(path),
      newNote: () => void newNote(),
    });

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
      page.show({ crumbs: crumbsOf(path), title: session.title, text: session.text, loadImage: images.load });
    } else page.showNothing();
    await drawList();
  }

  async function newNote(): Promise<void> {
    const folder = selection.kind === 'folder' ? selection.path : '';
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
      if (session && changed.has(session.path)) void session.diskChanged();
      void refresh();
    }, REDRAW_AFTER_MS);
  });

  const onBlur = () => void session?.flush();
  window.addEventListener('blur', onBlur);
  const onMenu = bridge.onMenu((command) => {
    if (command === 'new-note') void newNote();
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
      onMenu();
      clearTimeout(timer);
      window.removeEventListener('blur', onBlur);
    },
  };
}
