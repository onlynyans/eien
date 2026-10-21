// The sidebar's foot: the last action's news (when there's no list to show
// it), how many notes, day or night, the settings, and three panes or two.

import type { SettingValues } from '../../core/config';
import { h, wordButton } from '../dom';
import { noteCount } from '../list/note-count';

type Scheme = SettingValues['appearance.scheme'];

export interface FootModel {
  readonly notice: string | null;
  readonly noteCount: number;
  readonly scheme: Scheme;
  readonly two: boolean;
}

export interface FootActions {
  scheme(scheme: Scheme): void;
  panes(two: boolean): void;
  settings(): void;
}

export function sidebarFoot(model: FootModel, actions: FootActions): HTMLElement {
  /** Day or Night; pressed again, back to the system's. */
  const schemeButton = (label: string, scheme: Scheme) =>
    wordButton(label, () => actions.scheme(model.scheme === scheme ? 'system' : scheme), {
      'aria-pressed': String(model.scheme === scheme),
      'data-key': `scheme:${scheme}`,
    });
  const panesButton = (label: string, two: boolean) =>
    wordButton(label, () => actions.panes(two), {
      'aria-pressed': String(model.two === two),
      'data-key': `panes:${two ? 'two' : 'three'}`,
    });
  const pair = (label: string, ...buttons: HTMLElement[]) =>
    h('div', { class: 'sidebar__pair', attrs: { role: 'group', 'aria-label': label } }, ...buttons);
  return h(
    'footer',
    { class: 'sidebar__foot' },
    h('p', {
      class: 'sidebar__notice',
      text: model.notice ?? '',
      attrs: { role: 'status', hidden: !model.notice },
    }),
    h('p', { class: 'count sidebar__count', text: noteCount(model.noteCount) }),
    h(
      'div',
      { class: 'sidebar__foot-row' },
      pair('Day or night', schemeButton('Day', 'day'), schemeButton('Night', 'night')),
      wordButton('Settings', actions.settings, {
        'aria-haspopup': 'dialog',
        'data-key': 'settings',
      }),
    ),
    h(
      'div',
      { class: 'sidebar__foot-row sidebar__panes' },
      pair('Panes', panesButton('3 panes', false), panesButton('2 panes', true)),
    ),
  );
}
