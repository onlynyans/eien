// The page's ⋯ on a phone (spec §10): what the menu bar offers the open
// note on the desktop, as one menu under it. Each choice is the menu's own
// command (../menu/menu-bus.ts). The page's views are the layout's (../chrome);
// the formats are in the selection bar.

import type { SettingValues } from '../../core/config';
import { SPRINT_MINUTES } from '../../core/counters';
import type { MenuCommand } from '../../platform/bridge';
import type { MenuItem } from '../menu/menu';

export interface MoreState {
  readonly values: SettingValues;
  /** A sprint under way: Stop is offered, not another. */
  readonly sprinting: boolean;
  /** Export…: the note's own export choices (EPUB, Word, HTML), as its menu offers them. */
  exportTo(): void;
}

export function moreItems(state: MoreState, run: (command: MenuCommand) => void): MenuItem[] {
  const item = (label: string, command: MenuCommand): MenuItem => ({
    label,
    run: () => run(command),
  });
  const toggle = (
    label: string,
    key: 'editor.focus' | 'editor.typewriter' | 'editor.marks',
  ): MenuItem => ({
    label,
    run: () => run(`toggle:${key}`),
    checked: state.values[key] === 'on',
    toggle: true,
  });
  return [
    item('Find', 'find'),
    'separator',
    item('Seal', 'seal'),
    item('Compare', 'compare'),
    item('Versions', 'versions'),
    item('Outline cards', 'outline'),
    'separator',
    item('Copy as HTML', 'copy-html'),
    { label: 'Export…', run: state.exportTo },
    'separator',
    toggle('Focus mode', 'editor.focus'),
    toggle('Typewriter scrolling', 'editor.typewriter'),
    toggle('Show Markdown marks', 'editor.marks'),
    ...(state.sprinting
      ? [item('Stop sprint', 'sprint:stop')]
      : SPRINT_MINUTES.map((minutes) => item(`Sprint, ${minutes} minutes`, `sprint:${minutes}`))),
    'separator',
    item('Look', 'look'),
    item('Settings', 'settings'),
  ];
}
