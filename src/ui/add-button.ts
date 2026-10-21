// The quiet + (backlog #4, #26): the one control for making something —
// a folder or a tag beside its section's label, a note in the list's head.
// An icon button named for what it makes, with Eien's tooltip (and its key,
// when it has one); quiet, as every such control is: in sight while the row
// it sits in is hovered, or it has the keyboard (chrome/chrome.css).

import { ariaKeys, keyText } from './chrome/keys';
import { h } from './dom';
import { icon } from './icons';

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

export interface AddButton {
  /** What it makes, as its name and its tooltip: "New note". */
  readonly label: string;
  /** Its lasting name, for the keyboard after a redraw. */
  readonly key: string;
  /** Its key, as CodeMirror writes keys ("Mod-n"), shown in the tooltip and named for assistive tech. */
  readonly keys?: string;
  run(): void;
}

export function addButton({ label, key, keys, run }: AddButton): HTMLButtonElement {
  return h(
    'button',
    {
      class: 'icon-button icon-button--quiet add-button',
      attrs: {
        type: 'button',
        'aria-label': label,
        'aria-keyshortcuts': keys ? ariaKeys(keys, MAC) : undefined,
        'data-tip': label,
        'data-shortcut': keys ? keyText(keys, MAC) : undefined,
        'data-key': key,
      },
      on: { click: () => run() },
    },
    icon('plus'),
  );
}
