// The quiet + (backlog #4, #26): the one control for making something —
// a folder or a tag beside its section's label, a note in the list's head.

import { quietButton } from './quiet-button';

export interface AddButton {
  /** What it makes, as its name and its tooltip: "New note". */
  readonly label: string;
  /** Its lasting name, for the keyboard after a redraw. */
  readonly key: string;
  /** Its key, as CodeMirror writes keys ("Mod-n"). */
  readonly keys?: string;
  run(): void;
}

export const addButton = (add: AddButton): HTMLButtonElement =>
  quietButton({ ...add, icon: 'plus', class: 'add-button' });
