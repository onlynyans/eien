// What a shown vault follows: changes on disk (another device's), the
// settings, the window losing focus (a save), the menu's commands, and
// notes dragged in the list or the tree. One function stops them all.

import { VAULT_CONFIG } from '../../core/paths';
import type { VaultBridge } from '../../platform/bridge';
import { watchDrags } from '../list/drag';
import type { MenuBus } from '../menu/menu-bus';
import type { SettingsState } from '../settings/settings-state';
import type { PaneLayout } from '../shell/panes';
import { watchFolderDrags } from '../sidebar/folder-drag';
import { type CommandContext, runCommand } from './commands';
import { onDiskChanges, touches } from './disk-changes';
import type { FolderDrop } from './folder-order';
import { importFolder } from './importing';
import type { OpenNote } from './open-note';
import type { Organizer } from './organize';

export interface FollowOf {
  readonly vault: VaultBridge;
  readonly note: OpenNote;
  readonly settings: SettingsState;
  readonly panes: PaneLayout;
  readonly menu: MenuBus;
  readonly commands: Omit<CommandContext, 'importFolder'>;
  readonly organizer: Organizer;
  /** The sidebar's tree, where notes are dragged too. */
  readonly tree: HTMLElement;
  /** A folder dragged in the tree, let go (../sidebar/folder-drag.ts). */
  dropFolder(path: string, to: FolderDrop): void;
  /** Read the vault again (what the watcher named, read afresh), then draw. */
  refresh(changed?: Iterable<string>): Promise<void>;
  redraw(): Promise<void>;
  /** Run a file operation, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): Promise<void>;
  /** Whether the list shows a folder in its own order, so a note dropped there is placed. */
  listOrdered(): boolean;
  /** An imported folder, chosen in the sidebar. */
  showFolder(path: string): void;
  tell(message: string): void;
}

export function follow(of: FollowOf): () => void {
  const { note, settings } = of;
  const stopWatching = onDiskChanges(of.vault, (changed) => {
    if (note.path && touches(note.path, changed)) void note.session?.diskChanged();
    if (changed.has(VAULT_CONFIG)) void settings.reload(); // changed on another device
    of.commands.parts.diskChanged(changed); // another device sealed the open note
    void of.refresh(changed);
  });
  const stopSettings = settings.onChange((values, before) => {
    of.panes.setTwo(values['layout.panes'] === 'two'); // redraws when it changes
    if (values['books.numerals'] !== before['books.numerals']) void of.redraw();
  });
  const onBlur = () => void note.flush();
  window.addEventListener('blur', onBlur);
  const commands: CommandContext = {
    ...of.commands,
    importFolder: () =>
      void importFolder({ vault: of.vault, act: of.act, showFolder: of.showFolder, tell: of.tell }),
  };
  const stopMenu = of.menu.on((command) => runCommand(command, commands));
  const drags = {
    moveTo: (path: string, folder: string) =>
      void of.act(() => of.organizer.moveInto(path, folder, true)),
    placeBefore: (path: string, before: string | null) =>
      void of.act(() => of.organizer.placeBefore(path, before)),
  };
  watchDrags(of.commands.list, { ...drags, orderable: of.listOrdered });
  watchDrags(of.tree, { ...drags, orderable: () => false }, '.tree-row__name[data-path]');
  watchFolderDrags(of.tree, of.dropFolder);
  return () => {
    stopWatching();
    stopSettings();
    stopMenu();
    window.removeEventListener('blur', onBlur);
  };
}
