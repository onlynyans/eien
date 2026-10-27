// Find and replace in the open note (spec §4, Find in the note): each of
// its commands with its name and its key, written once as CodeMirror writes
// keys, for the Edit menu, the editor's keymap and the find bar's tooltips.

export type FindCommandId =
  | 'find'
  | 'replace'
  | 'next'
  | 'previous'
  | 'replace-one'
  | 'replace-all';

export interface FindCommand {
  readonly id: FindCommandId;
  /** Its name: the menu's words, and the control's. */
  readonly label: string;
  /** Its key, as CodeMirror writes keys: "Mod" is ⌘ on a Mac, Ctrl elsewhere. */
  readonly key: string;
  /**
   * Its key on Windows and Linux, where it isn't `key`: there Ctrl+Alt is
   * AltGr, which types characters, so Find and Replace is Ctrl+H, as
   * Windows' own editors have it.
   */
  readonly keyOffMac?: string;
}

export const FIND_COMMANDS: readonly FindCommand[] = [
  { id: 'find', label: 'Find', key: 'Mod-f' },
  { id: 'replace', label: 'Find and replace', key: 'Mod-Alt-f', keyOffMac: 'Ctrl-h' },
  { id: 'next', label: 'Next match', key: 'Mod-g' },
  { id: 'previous', label: 'Previous match', key: 'Mod-Shift-g' },
  // Enter in the Replace field: the current match, and on to the next.
  { id: 'replace-one', label: 'Replace', key: 'Enter' },
  // Not Ctrl+Shift+Enter off the Mac: that's Focus mode. AltGr+Enter types nothing.
  { id: 'replace-all', label: 'Replace all', key: 'Mod-Alt-Enter' },
];

/** The command `id`'s key on a Mac, or on Windows and Linux. */
export function findKey(id: FindCommandId, mac: boolean): string {
  const command = FIND_COMMANDS.find((each) => each.id === id);
  if (!command) throw new Error(`No find command ${id}`);
  return (mac ? undefined : command.keyOffMac) ?? command.key;
}

export const findLabel = (id: FindCommandId): string =>
  FIND_COMMANDS.find((each) => each.id === id)?.label ?? id;
