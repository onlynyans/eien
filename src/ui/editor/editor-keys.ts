// The editor's keys: the formats, the scene break on Enter, the history's
// keys, and CodeMirror's own. The history is the note's, not the view's
// (./note-doc.ts), so its keys, and the Edit menu's Undo and Redo, which
// arrive as input events, run on the note's document.

import { defaultKeymap, redo, redoSelection, undo, undoSelection } from '@codemirror/commands';
import type { Extension, StateCommand } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { FORMAT_COMMANDS, type FormatCommand, keyOn } from '../../core/format';
import { sceneBreak } from './writing-tools';

/** Runs a history command on the note's document, for this view: false if there was nothing to do. */
export type OnDoc = (command: StateCommand) => boolean;

/** The keys, `format` running a format and `onDoc` a history command. */
export function editorKeys(format: (command: FormatCommand) => boolean, onDoc: OnDoc): Extension {
  // CodeMirror takes `mac` on a Mac, `key` elsewhere.
  const formatKeys = FORMAT_COMMANDS.map((command) => ({
    key: keyOn(command, false),
    mac: keyOn(command, true),
    run: () => format(command),
  }));
  const run = (command: StateCommand) => () => onDoc(command);
  return keymap.of([
    ...formatKeys,
    { key: 'Enter', run: sceneBreak },
    // CodeMirror's history keys (historyKeymap, @codemirror/commands), on the document's history.
    { key: 'Mod-z', run: run(undo), preventDefault: true },
    { key: 'Mod-y', mac: 'Mod-Shift-z', run: run(redo), preventDefault: true },
    { linux: 'Ctrl-Shift-z', run: run(redo), preventDefault: true },
    { key: 'Mod-u', run: run(undoSelection), preventDefault: true },
    { key: 'Alt-u', mac: 'Mod-Shift-u', run: run(redoSelection), preventDefault: true },
    ...defaultKeymap,
  ]);
}

/** The Edit menu's Undo and Redo, which arrive as input events, as history() would take them. */
export const historyInput = (onDoc: OnDoc): Extension =>
  EditorView.domEventHandlers({
    beforeinput: (event) => {
      const command =
        event.inputType === 'historyUndo' ? undo : event.inputType === 'historyRedo' ? redo : null;
      if (!command) return false;
      event.preventDefault();
      return onDoc(command);
    },
  });
