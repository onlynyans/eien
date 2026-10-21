// The page's ⋯ on a phone (spec §10): what the menu bar offers the open
// note on the desktop, as one menu under it. Each choice is the menu's own
// command (../menu/menu-bus.ts). The page's views stay in its bar; the
// formats are in the selection bar.

import type { SettingValues } from '../../core/config';
import { SPRINT_MINUTES } from '../../core/counters';
import type { MenuCommand } from '../../platform/bridge';
import type { MenuItem } from '../menu/menu';

export interface MoreState {
  readonly values: SettingValues;
  /** A sprint under way: Stop is offered, not another. */
  readonly sprinting: boolean;
}

export function moreItems(state: MoreState, run: (command: MenuCommand) => void): MenuItem[] {
  const item = (label: string, command: MenuCommand, checked?: boolean): MenuItem => ({
    label,
    run: () => run(command),
    checked,
  });
  const on = (key: 'editor.focus' | 'editor.typewriter') => state.values[key] === 'on';
  return [
    item('Seal', 'seal'),
    item('Compare', 'compare'),
    item('Versions', 'versions'),
    item('Outline cards', 'outline'),
    'separator',
    item('Copy for AO3', 'copy-ao3'),
    item('Export AO3 HTML', 'export-ao3'),
    'separator',
    item('Focus mode', 'toggle:editor.focus', on('editor.focus')),
    item('Typewriter scrolling', 'toggle:editor.typewriter', on('editor.typewriter')),
    ...(state.sprinting
      ? [item('Stop sprint', 'sprint:stop')]
      : SPRINT_MINUTES.map((minutes) => item(`Sprint, ${minutes} minutes`, `sprint:${minutes}`))),
    'separator',
    item('Settings', 'settings'),
  ];
}
