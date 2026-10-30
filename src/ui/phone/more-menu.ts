// The page's ⋯ on a phone (spec §10): what the menu bar offers the open
// note on the desktop, as one menu under it. Each choice is the menu's own
// command (../menu/menu-bus.ts). The page's views are the layout's (../chrome);
// the formats are in the selection bar.

import type { SettingValues } from '../../core/config';
import { SPRINT_MINUTES } from '../../core/counters';
import type { MenuCommand } from '../../platform/bridge';
import { menuOff } from '../chrome/commands';
import type { MenuItem } from '../menu/menu';
import type { PageKind } from '../page/page-leaf';

export interface MoreState {
  readonly values: SettingValues;
  /** A sprint under way: Stop is offered, not another. */
  readonly sprinting: boolean;
  /** Export…: the note's own export choices (EPUB, Word, HTML), as its menu offers them. */
  exportTo(): void;
  /** What the page holds: a note's own choices are disabled on another kind's (an EPUB's, #40). */
  readonly kind?: PageKind;
  /** A book's: the words chosen in it quoted in the note (#40, Phase 2c). */
  quote?(): void;
  /** A book's: whether the page in sight is bookmarked (Phase 4b), its choice checked. */
  readonly bookmarked?: boolean;
}

export function moreItems(state: MoreState, run: (command: MenuCommand) => void): MenuItem[] {
  /** A note's own choices: there, but disabled, with another kind of page in front, as the menu bar's. */
  const off = new Set<MenuCommand>(menuOff(state.kind ?? 'note'));
  const item = (label: string, command: MenuCommand): Exclude<MenuItem, 'separator'> => ({
    label,
    run: () => run(command),
    disabled: off.has(command) || undefined,
  });
  const toggle = (
    label: string,
    key: 'editor.focus' | 'editor.typewriter' | 'editor.marks',
  ): MenuItem => ({
    ...item(label, `toggle:${key}`),
    checked: state.values[key] === 'on',
    toggle: true,
  });
  return [
    // A page's command, whatever it holds (docs/page-kinds.md): a book's Find comes with Phase 5.
    item('Find', 'find'),
    // A book's own, where the selection bar would be on the desktop (the system's callout is over the words).
    ...(state.kind === 'epub' && state.quote
      ? [{ label: 'Quote in the note', run: state.quote } satisfies MenuItem]
      : []),
    ...(state.kind === 'epub'
      ? [
          {
            ...item('Bookmark this page', 'bookmark'),
            checked: state.bookmarked === true,
            toggle: true,
          } satisfies MenuItem,
        ]
      : []),
    'separator',
    item('Seal', 'seal'),
    item('Compare', 'compare'),
    item('Versions', 'versions'),
    item('Outline cards', 'outline'),
    'separator',
    item('Copy as HTML', 'copy-html'),
    // The note's own export choices, as the menu bar's Export Note.
    { label: 'Export…', run: state.exportTo, disabled: off.has('export-note:epub') || undefined },
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
