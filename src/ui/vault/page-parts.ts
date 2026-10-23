// What the pages of a shown vault share (each page's own note and seals are
// ./pages.ts's): the counters (./counting.ts), Copy as HTML (./copy-html.ts),
// the exports (./exports.ts) and outline cards (./outline.ts), each acting on
// the active page — made together, kept in step together, stopped together.

import type { Bridge } from '../../platform/bridge';
import type { Counters } from '../counters/counters';
import type { Written } from '../page/word-count';
import type { SettingsState } from '../settings/settings-state';
import { type HtmlCopy, htmlCopy } from './copy-html';
import { counting } from './counting';
import { type Exports, exportsOf } from './exports';
import type { Navigation } from './navigation';
import type { Organizer } from './organize';
import { type Outline, outlineCards } from './outline';
import type { Pages } from './pages';
import type { VaultState } from './vault-state';

export interface PagePartsOf {
  readonly pages: Pages;
  readonly state: VaultState;
  readonly bridge: Bridge;
  readonly settings: SettingsState;
  readonly nav: Navigation;
  readonly organizer: Organizer;
  tell(message: string): void;
  /** Run a file operation, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): Promise<void>;
  openNote(path: string): Promise<void>;
}

export interface PageParts {
  readonly counters: Counters;
  readonly htmlCopy: HtmlCopy;
  readonly exports: Exports;
  readonly outline: Outline;
  /** Words the writer added on a page (./pages.ts tells them). */
  wrote(added: number, when: Written): void;
  /** A page's words counted again. */
  counted(): void;
  /** Another note open, or the vault read again. */
  sync(): void;
  stop(): void;
}

export function pageParts(of: PagePartsOf): PageParts {
  const { pages, state, settings, tell } = of;
  const active = () => pages.active;
  const counts = counting({
    pane: pages.pane,
    active,
    flushWords: () => pages.flushWords(),
    state,
    tell,
  });
  const outline = outlineCards({
    active,
    state,
    nav: of.nav,
    organizer: of.organizer,
    numerals: () => settings.values['books.numerals'],
    openNote: of.openNote,
    act: (operation) => void of.act(operation),
    tell,
  });
  return {
    counters: counts.counters,
    htmlCopy: htmlCopy({ active, out: of.bridge.out, settings, tell }),
    exports: exportsOf({
      state,
      nav: of.nav,
      openPath: () => pages.active.note.path,
      openText: (path) => pages.session(path)?.text ?? null,
      vault: of.bridge.vault,
      out: of.bridge.out,
      settings,
      tell,
    }),
    outline,
    wrote: counts.wrote,
    counted: counts.counted,
    sync() {
      void counts.sync(); // another note open is seen here, whatever opened or closed it
      void outline.sync();
    },
    stop: () => counts.stop(),
  };
}
