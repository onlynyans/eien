// The sidebar: the vault's contents page. Library, then the folder tree;
// at the foot, day or night, and the settings.

import type { SettingValues } from '../../core/config';
import type { FolderNode } from '../../core/vault';
import { h, wordButton } from '../dom';
import type { Selection } from '../vault/vault-state';

export interface SidebarModel {
  readonly name: string;
  readonly tree: FolderNode;
  readonly selection: Selection;
  /** Folder paths shown open. */
  readonly open: ReadonlySet<string>;
  readonly scheme: Scheme;
}

type Scheme = SettingValues['appearance.scheme'];

export interface SidebarActions {
  select(selection: Selection): void;
  toggle(path: string): void;
  scheme(scheme: Scheme): void;
  settings(): void;
}

export function renderSidebar(
  container: HTMLElement,
  model: SidebarModel,
  actions: SidebarActions,
): void {
  const selected = (selection: Selection) =>
    model.selection.kind === selection.kind &&
    (selection.kind === 'all' ||
      (model.selection.kind === 'folder' && model.selection.path === selection.path));

  const row = (
    label: string,
    count: number,
    selection: Selection,
    depth = 0,
    twist?: HTMLElement,
  ) => {
    const item = h(
      'li',
      { class: 'tree-row' },
      twist ?? h('span', { class: 'tree-row__twist' }),
      h(
        'button',
        {
          class: 'tree-row__name',
          attrs: { type: 'button', 'aria-current': selected(selection) ? 'true' : undefined },
          on: { click: () => actions.select(selection) },
        },
        h('span', { class: 'tree-row__label', text: label }),
        h('span', { class: 'count', text: count.toLocaleString() }),
      ),
    );
    // Through the style API: the security policy refuses style attributes.
    item.style.setProperty('--depth', String(depth));
    return item;
  };

  /** Day or Night; pressed again, back to the system's. */
  const schemeButton = (label: string, scheme: Scheme) =>
    wordButton(label, () => actions.scheme(model.scheme === scheme ? 'system' : scheme), {
      'aria-pressed': String(model.scheme === scheme),
    });

  const folderRows = (node: FolderNode, depth: number): HTMLElement[] =>
    node.folders.flatMap((folder) => {
      const open = model.open.has(folder.path);
      const twist = folder.folders.length
        ? h('button', {
            class: 'tree-row__twist',
            text: open ? '▾' : '▸',
            attrs: {
              type: 'button',
              'aria-expanded': String(open),
              'aria-label': `${open ? 'Close' : 'Open'} ${folder.name}`,
            },
            on: { click: () => actions.toggle(folder.path) },
          })
        : undefined;
      const own = row(
        folder.name,
        folder.noteCount,
        { kind: 'folder', path: folder.path },
        depth,
        twist,
      );
      return open ? [own, ...folderRows(folder, depth + 1)] : [own];
    });

  container.replaceChildren(
    h(
      'header',
      { class: 'sidebar__head' },
      h('span', { class: 'seal', text: '永', attrs: { 'aria-hidden': 'true' } }),
      h('span', { class: 'sidebar__vault', text: model.name }),
    ),
    h(
      'nav',
      { class: 'sidebar__tree', attrs: { 'aria-label': 'Notes' } },
      h('p', { class: 'label sidebar__label', text: 'Library' }),
      h('ul', { class: 'tree' }, row('All Notes', model.tree.noteCount, { kind: 'all' })),
      model.tree.folders.length > 0 && h('p', { class: 'label sidebar__label', text: 'Folders' }),
      model.tree.folders.length > 0 && h('ul', { class: 'tree' }, ...folderRows(model.tree, 0)),
    ),
    h(
      'footer',
      { class: 'sidebar__foot' },
      h('p', {
        class: 'count sidebar__count',
        text: `${model.tree.noteCount.toLocaleString()} notes`,
      }),
      h(
        'div',
        { class: 'sidebar__foot-row' },
        h(
          'div',
          { class: 'sidebar__pair', attrs: { role: 'group', 'aria-label': 'Day or night' } },
          schemeButton('Day', 'day'),
          schemeButton('Night', 'night'),
        ),
        wordButton('Settings', actions.settings, { 'aria-haspopup': 'dialog' }),
      ),
    ),
  );
}
