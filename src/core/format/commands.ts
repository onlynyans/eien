// Every formatting command, once: its name, its key, and what it does. The
// editor's keys, the Format menu and the selection bar all read this list.

import type { Edit, Selection } from './edit';
import { BOLD, HIGHLIGHT, ITALIC, STRIKE, toggleInline, UNDERLINE } from './inline';
import { headingLevel, type LineFormat, toggleLines } from './lines';
import { insertLink } from './link';

export type FormatCommandId =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'highlight'
  | 'link'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'quote'
  | 'bullet'
  | 'numbered'
  | 'checklist';

export interface FormatCommand {
  readonly id: FormatCommandId;
  /** The menu's words for it. */
  readonly label: string;
  /** Its key, as CodeMirror writes keys: "Mod" is ⌘ on a Mac, Ctrl elsewhere. */
  readonly key: string;
  /**
   * Its key on Windows and Linux, where it isn't `key`: there Ctrl+Alt is
   * AltGr, which types characters (², ³ and @ on a German keyboard).
   */
  readonly keyOffMac?: string;
  /** Shown in the selection bar (the commonest inline ones). */
  readonly inBar: boolean;
  run(text: string, selection: Selection): Edit;
}

const lines = (format: LineFormat) => (text: string, selection: Selection) =>
  toggleLines(text, selection, format);

export const FORMAT_COMMANDS: readonly FormatCommand[] = [
  { id: 'bold', label: 'Bold', key: 'Mod-b', inBar: true, run: (t, s) => toggleInline(t, s, BOLD) },
  {
    id: 'italic',
    label: 'Italic',
    key: 'Mod-i',
    inBar: true,
    run: (t, s) => toggleInline(t, s, ITALIC),
  },
  {
    id: 'underline',
    label: 'Underline',
    key: 'Mod-u',
    inBar: true,
    run: (t, s) => toggleInline(t, s, UNDERLINE),
  },
  {
    id: 'strike',
    label: 'Strikethrough',
    key: 'Mod-Shift-x',
    inBar: true,
    run: (t, s) => toggleInline(t, s, STRIKE),
  },
  {
    id: 'highlight',
    label: 'Highlight',
    key: 'Mod-Shift-h',
    inBar: true,
    run: (t, s) => toggleInline(t, s, HIGHLIGHT),
  },
  { id: 'link', label: 'Link', key: 'Mod-k', inBar: true, run: insertLink },
  {
    id: 'heading1',
    label: 'Heading 1',
    key: 'Mod-Alt-1',
    keyOffMac: 'Mod-Shift-1',
    inBar: false,
    run: lines({ kind: 'heading', level: 1 }),
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    key: 'Mod-Alt-2',
    keyOffMac: 'Mod-Shift-2',
    inBar: false,
    run: lines({ kind: 'heading', level: 2 }),
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    key: 'Mod-Alt-3',
    keyOffMac: 'Mod-Shift-3',
    inBar: false,
    run: lines({ kind: 'heading', level: 3 }),
  },
  { id: 'quote', label: 'Quote', key: 'Mod-Shift-.', inBar: false, run: lines({ kind: 'quote' }) },
  {
    id: 'numbered',
    label: 'Numbered List',
    key: 'Mod-Shift-7',
    inBar: false,
    run: lines({ kind: 'numbered' }),
  },
  {
    id: 'bullet',
    label: 'Bulleted List',
    key: 'Mod-Shift-8',
    inBar: false,
    run: lines({ kind: 'bullet' }),
  },
  {
    id: 'checklist',
    label: 'Checklist',
    key: 'Mod-Shift-9',
    inBar: false,
    run: lines({ kind: 'checklist' }),
  },
];

export const formatCommand = (id: string): FormatCommand | undefined =>
  FORMAT_COMMANDS.find((command) => command.id === id);

/** `command`'s key on a Mac, or on Windows and Linux. */
export const keyOn = (command: FormatCommand, mac: boolean): string =>
  (mac ? undefined : command.keyOffMac) ?? command.key;

/** A CodeMirror key ("Mod-Shift-x") as an Electron accelerator ("CmdOrCtrl+Shift+X"). */
export const acceleratorOf = (key: string): string =>
  key
    .split('-')
    .map((part) => (part === 'Mod' ? 'CmdOrCtrl' : part.length === 1 ? part.toUpperCase() : part))
    .join('+');

/**
 * The formatting bar's one heading control: each press takes the caret's
 * line a level down, 1, 2, 3, then off (Heading 3 again takes it off). A
 * deeper heading (4 to 6) becomes 3.
 */
export function nextHeading(line: string): 'heading1' | 'heading2' | 'heading3' {
  const level = headingLevel(line);
  return level === 0 ? 'heading1' : level === 1 ? 'heading2' : 'heading3';
}
