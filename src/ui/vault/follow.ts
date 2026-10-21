// What a shown vault follows: changes on disk (another device's), the
// settings, the window losing focus (a save), and the menu's commands. One
// function stops them all.

import { VAULT_CONFIG } from '../../core/paths';
import type { VaultBridge } from '../../platform/bridge';
import type { MenuBus } from '../menu/menu-bus';
import type { SettingsState } from '../settings/settings-state';
import type { PaneLayout } from '../shell/panes';
import { type CommandContext, runCommand } from './commands';
import { onDiskChanges, touches } from './disk-changes';
import type { OpenNote } from './open-note';

export interface FollowOf {
  readonly vault: VaultBridge;
  readonly note: OpenNote;
  readonly settings: SettingsState;
  readonly panes: PaneLayout;
  readonly menu: MenuBus;
  readonly commands: CommandContext;
  /** Read the vault again, then draw. */
  refresh(): Promise<void>;
  redraw(): Promise<void>;
}

export function follow(of: FollowOf): () => void {
  const { note, settings } = of;
  const stopWatching = onDiskChanges(of.vault, (changed) => {
    if (note.path && touches(note.path, changed)) void note.session?.diskChanged();
    if (changed.has(VAULT_CONFIG)) void settings.reload(); // changed on another device
    of.commands.parts.diskChanged(changed); // another device sealed the open note
    void of.refresh();
  });
  const stopSettings = settings.onChange((values, before) => {
    of.panes.setTwo(values['layout.panes'] === 'two'); // redraws when it changes
    if (
      values['books.numerals'] !== before['books.numerals'] ||
      values['appearance.scheme'] !== before['appearance.scheme']
    ) {
      void of.redraw();
    }
  });
  const onBlur = () => void note.flush();
  window.addEventListener('blur', onBlur);
  const stopMenu = of.menu.on((command) => runCommand(command, of.commands));
  return () => {
    stopWatching();
    stopSettings();
    stopMenu();
    window.removeEventListener('blur', onBlur);
  };
}
