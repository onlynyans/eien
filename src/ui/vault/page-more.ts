// A companion's ⋯ (spec §4, Split, Companion): what the page's tools do,
// for the companion's note, as the companion keeps only its own few in sight:
// its views, Seal, Versions, Compare, Copy as HTML, and Open in New Window.
// Each makes the companion the active page first, so it acts on its note.

import type { MenuCommand } from '../../platform/bridge';
import { type MenuItem, openMenu } from '../menu/menu';
import type { NoteSide, Pages } from './pages';

export interface PageMoreOf {
  readonly pages: Pages;
  run(command: MenuCommand): void;
  /** A note in a window of its own: the desktop's only. */
  readonly openInNewWindow?: (path: string) => void;
}

export function pageMore(of: PageMoreOf, side: NoteSide, opener: HTMLElement): void {
  const run = (command: MenuCommand) => () => {
    of.pages.activate(side);
    of.run(command);
  };
  const { mode } = side.page;
  const path = side.note.path;
  const items: MenuItem[] = [
    { label: 'Live', icon: 'live', checked: mode === 'live', run: run('view:live') },
    { label: 'Source', icon: 'source', checked: mode === 'source', run: run('view:source') },
    { label: 'Reading', icon: 'reading', checked: mode === 'reading', run: run('view:reading') },
    'separator',
    { label: 'Seal', keys: 'Mod-s', run: run('seal') },
    { label: 'Versions', icon: 'versions', run: run('versions') },
    { label: 'Compare', icon: 'compare', keys: 'Mod-Shift-d', run: run('compare') },
    { label: 'Copy as HTML', icon: 'copy', keys: 'Mod-Shift-c', run: run('copy-html') },
    ...(of.openInNewWindow && path
      ? [
          'separator' as const,
          {
            label: 'Open in New Window',
            icon: 'window' as const,
            run: () => of.openInNewWindow?.(path),
          },
        ]
      : []),
  ];
  openMenu(items, { opener }, side.page.name || 'This note', true);
}
