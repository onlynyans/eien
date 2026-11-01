// The shell a vault is shown in (./shell.css): the sidebar given, the note
// list with its search band above its rows, and the page pane's `main`,
// side by side. What fills each is the vault view's (../vault/vault-view.ts).

import { h } from '../dom';

export interface VaultFrame {
  readonly shell: HTMLElement;
  readonly list: HTMLElement;
  /** Where the one search field goes while the list is in sight. */
  readonly listSearch: HTMLElement;
  /** The list's rows. */
  readonly listBody: HTMLElement;
  /** The page pane's area. */
  readonly pageArea: HTMLElement;
}

export function vaultFrame(sidebar: HTMLElement): VaultFrame {
  const listSearch = h('div', { class: 'list__search' });
  const listBody = h('div', { class: 'list__body' });
  const list = h(
    'section',
    { class: 'list', attrs: { 'aria-label': 'Notes' } },
    listSearch,
    listBody,
  );
  const pageArea = h('main', { class: 'page' });
  const shell = h('div', { class: 'shell' }, sidebar, list, pageArea);
  return { shell, list, listSearch, listBody, pageArea };
}
