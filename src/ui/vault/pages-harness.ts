// For the window's tests only: pages (./pages.ts) over a vault in memory, with
// settings that can change, wired as the vault view wires them, less the panes.

import { vi } from 'vitest';
import type { SettingValues } from '../../core/config';
import { withDefaults } from '../../core/config/settings';
import type { OutBridge, VaultBridge } from '../../platform/bridge';
import { VaultIndex } from '../../platform/index';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import type { SettingsState } from '../settings/settings-state';
import { Navigation } from './navigation';
import type { Organizer } from './organize';
import type { PageKindOf } from './page-side';
import { isNote, type NoteSide, Pages, type Side } from './pages';
import { VaultState } from './vault-state';

/** Pages over a vault in memory, with settings that can change; `kinds`, besides a note's. */
export async function pagesWith(
  files: Record<string, string>,
  chosen: Partial<SettingValues> = {},
  kinds: readonly PageKindOf[] = [],
) {
  const storage = new MemoryStorage();
  for (const [path, text] of Object.entries(files)) storage.put(path, text);
  const index = new VaultIndex(storage);
  await index.refresh();
  const vault = {
    list: async () => index.entries(),
    notes: async () => index.notes(),
    listFiles: (folder: string) => storage.listFiles(folder),
    read: (path: string) => storage.read(path),
    readBytes: (path: string) => storage.readBytes(path),
    write: (path: string, text: string, expected: string | null) =>
      storage.write(path, text, expected),
    writeNew: async () => true,
  } as unknown as VaultBridge;
  const state = new VaultState(vault, 'V');
  await state.refresh();
  const listeners = new Set<(values: SettingValues, before: SettingValues) => void>();
  const settings = {
    values: withDefaults(chosen),
    onChange: (listener: (values: SettingValues, before: SettingValues) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const change = (next: Partial<SettingValues>) => {
    const before = settings.values;
    settings.values = withDefaults(next, before); // the first that has it wins
    for (const listener of listeners) listener(settings.values, before);
  };
  const area = document.body.appendChild(document.createElement('main'));
  /** How many times the pages told the window their seals' controls changed. */
  let told = 0;
  /** How many times the pages said they changed (rearranged), for the window to draw. */
  let rearranged = 0;
  const pages = new Pages({
    kinds,
    area,
    vault,
    state,
    organizer: {} as Organizer,
    nav: new Navigation(),
    out: {
      kinds: ['html'],
      copy: async () => {},
      saveAs: async () => null,
    } as unknown as OutBridge,
    settings: settings as unknown as SettingsState,
    mac: false,
    openNote: async () => {},
    act: async (operation) => void (await operation()),
    tell: () => {},
    changed: () => {
      told++;
    },
    rearranged: () => {
      rearranged++;
    },
    refresh: () => {},
  });
  // What the pages counted as written (today's tally), each stretch's words.
  const wrote = vi.spyOn(pages.parts, 'wrote');
  return {
    pages,
    storage,
    area,
    settings: settings as unknown as SettingsState,
    change,
    wrote: () => wrote.mock.calls.map(([added]) => added),
    rearranged: () => rearranged,
    told: () => told,
  };
}

/** Type at the end of the active page's note, as the writer does. */
export function typeAtEnd(pages: Pages, words: string): void {
  const { view } = noted(pages.active).page.editor;
  view.dispatch({
    changes: { from: view.state.doc.length, insert: words },
    userEvent: 'input.type',
  });
}

/** `side`, which holds a note: the tests that reach its editor, words or seals say so. */
export function noted(side: Side | null | undefined): NoteSide {
  if (!side || !isNote(side)) throw new Error('not a note’s page');
  return side;
}
