// A quiet icon button (system.md, "Quiet controls"): named for what it does,
// with Eien's tooltip (and its key, when it has one); in sight while the row
// or page it sits in is hovered, or it has the keyboard (chrome/chrome.css).

import { ariaKeys, keyText } from './chrome/keys';
import { h } from './dom';
import { type IconName, icon } from './icons';

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

export interface QuietButton {
  /** What it does, as its name and its tooltip: "New note". */
  readonly label: string;
  readonly icon: IconName;
  /** Its lasting name, for the keyboard after a redraw. */
  readonly key?: string;
  /** Its key, as CodeMirror writes keys ("Mod-n"), shown in the tooltip and named for assistive tech. */
  readonly keys?: string;
  /** Classes besides the quiet icon button's own. */
  readonly class?: string;
  run(): void;
}

export function quietButton(of: QuietButton): HTMLButtonElement {
  return h(
    'button',
    {
      class: `icon-button icon-button--quiet${of.class ? ` ${of.class}` : ''}`,
      attrs: {
        type: 'button',
        'aria-label': of.label,
        'aria-keyshortcuts': of.keys ? ariaKeys(of.keys, MAC) : undefined,
        'data-tip': of.label,
        'data-shortcut': of.keys ? keyText(of.keys, MAC) : undefined,
        'data-key': of.key,
      },
      on: { click: () => of.run() },
    },
    icon(of.icon),
  );
}
