// The table editor (spec §4, Tables) as the note's editor wears it: what it
// needs in every view (where its controls are drawn, where it says what it
// did), and what works in Live alone (its keys, what's typed in a cell, the
// grips and +, a cell's right-click).

import type { Extension } from '@codemirror/state';
import { tableSay } from './table-commands';
import { tableInput } from './table-input';
import { tableKeys } from './table-keys';
import { cellContextMenu } from './table-menus';
import { tableTools, tableToolsHost } from './table-tools';

/** In every view: the controls drawn in `host`, what was done told to `say`. */
export const tableEditor = (host: HTMLElement, say: (words: string) => void): Extension => [
  tableToolsHost.of(host),
  tableSay.of(say),
];

/** In Live: a table edited in place. */
export const tableEditing: Extension = [tableKeys, tableInput, tableTools, cellContextMenu];
