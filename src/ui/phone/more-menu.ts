// The page's ⋯ on a phone (spec §10): what the menu bar offers the open
// note on the desktop, as one menu under it. Each choice is the menu's own
// command (../menu/menu-bus.ts). The page's views are the layout's (../chrome);
// the formats are in the selection bar.

import type { SettingValues } from '../../core/config';
import { SPRINT_MINUTES } from '../../core/counters';
import type { MenuCommand } from '../../platform/bridge';
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
}

export function moreItems(state: MoreState, run: (command: MenuCommand) => void): MenuItem[] {
  const other = (state.kind ?? 'note') !== 'note';
  const item = (label: string, command: MenuCommand): MenuItem => ({
    label,
    run: () => run(command),
  });
  /** A note's own choice: there, but disabled, with another kind of page in front. */
  const notes = (choice: MenuItem): MenuItem =>
    other && choice !== 'separator' ? { ...choice, disabled: true } : choice;
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
    // A page's command, whatever it holds (docs/page-kinds.md): a book's Find comes with Phase 5.
    item('Find', 'find'),
    // A book's own, where the selection bar would be on the desktop (the system's callout is over the words).
    ...(state.kind === 'epub' && state.quote
      ? [{ label: 'Quote in the note', run: state.quote } satisfies MenuItem]
      : []),
    'separator',
    ...[
      item('Seal', 'seal'),
      item('Compare', 'compare'),
      item('Versions', 'versions'),
      item('Outline cards', 'outline'),
    ].map(notes),
    'separator',
    notes(item('Copy as HTML', 'copy-html')),
    notes({ label: 'Export…', run: state.exportTo }),
    'separator',
    ...[
      toggle('Focus mode', 'editor.focus'),
      toggle('Typewriter scrolling', 'editor.typewriter'),
      toggle('Show Markdown marks', 'editor.marks'),
    ].map(notes),
    ...(state.sprinting
      ? [item('Stop sprint', 'sprint:stop')]
      : SPRINT_MINUTES.map((minutes) => item(`Sprint, ${minutes} minutes`, `sprint:${minutes}`))),
    'separator',
    item('Look', 'look'),
    item('Settings', 'settings'),
  ];
}
