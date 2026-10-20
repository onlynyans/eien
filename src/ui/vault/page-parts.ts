// What the open note's page has besides the note: its seals (../versions),
// its counters (./counting.ts), Copy for AO3 (./ao3-out.ts), outline cards
// (./outline.ts) and the settings it follows (./note-page.ts) — made
// together, kept in step together, stopped together.

import type { Bridge } from '../../platform/bridge';
import type { Counters } from '../counters/counters';
import type { PageView } from '../page/page';
import type { SettingsState } from '../settings/settings-state';
import { VersionsUI } from '../versions/versions-ui';
import { type Ao3Out, ao3Out } from './ao3-out';
import { counting } from './counting';
import type { Navigation } from './navigation';
import { followSettings } from './note-page';
import type { OpenNote } from './open-note';
import type { Organizer } from './organize';
import { type Outline, outlineCards } from './outline';
import type { VaultState } from './vault-state';

export interface PagePartsOf {
  readonly page: PageView;
  readonly note: OpenNote;
  readonly state: VaultState;
  readonly bridge: Bridge;
  readonly settings: SettingsState;
  readonly nav: Navigation;
  readonly organizer: Organizer;
  /** The Mac's keys, for the keys the versions panel names. */
  readonly mac: boolean;
  tell(message: string): void;
  /** Run a file operation, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): Promise<void>;
  openNote(path: string): void;
}

export interface PageParts {
  readonly versions: VersionsUI;
  readonly counters: Counters;
  readonly ao3: Ao3Out;
  readonly outline: Outline;
  /** Another note open, or the vault read again. */
  sync(): void;
  /** Files changed on disk: another device may have sealed the open note. */
  diskChanged(changed: ReadonlySet<string>): void;
  stop(): void;
}

export function pageParts(of: PagePartsOf): PageParts {
  const { page, note, state, settings, tell } = of;
  const versions = new VersionsUI({
    page,
    note,
    vault: of.bridge.vault,
    notesWithId: (id) => state.notesWithId(id),
    mac: of.mac,
    tell,
    serial: of.act,
  });
  const counts = counting({ page, note: () => note, state, tell });
  const outline = outlineCards({
    page,
    state,
    nav: of.nav,
    organizer: of.organizer,
    note: () => note,
    numerals: () => settings.values['books.numerals'],
    openNote: of.openNote,
    act: (operation) => void of.act(operation),
    tell,
  });
  const stopSettings = followSettings(page, settings);
  return {
    versions,
    counters: counts.counters,
    ao3: ao3Out({ page, note, out: of.bridge.out, settings, tell }),
    outline,
    sync() {
      versions.sync(); // another note open is seen here, whatever opened or closed it
      void counts.sync();
      void outline.sync();
    },
    diskChanged: (changed) => void versions.diskChanged(changed),
    stop() {
      versions.stop();
      counts.stop();
      stopSettings();
    },
  };
}
