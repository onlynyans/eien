// Find in the note, in the editor: CodeMirror's search state, drawn by the
// window's find bar (./find-bar.ts), and its keys. They run in the text and in
// the bar's fields alike (the 'search-panel' scope), and before the editor's
// other keys, so Esc shuts the bar before it does anything else.

import { search } from '@codemirror/search';
import { type Extension, Prec } from '@codemirror/state';
import { type Command, EditorView, type KeyBinding, keymap } from '@codemirror/view';
import { type FindCommandId, findKey } from '../../core/find';
import { FIND_SCOPE, type FindBar } from './find-bar';

export function findInNote(bar: FindBar): Extension {
  const both = `editor ${FIND_SCOPE}`;
  const bind = (id: FindCommandId, run: Command, scope = both): KeyBinding => ({
    key: findKey(id, false),
    mac: findKey(id, true),
    run,
    scope,
    preventDefault: true,
  });
  return [
    search({
      top: true,
      literal: true,
      createPanel: (view) => bar.panel(view),
      scrollToMatch: (range) => bar.scrollTo(range),
    }),
    // Shift as held, before any keymap reads the key (FindBar.shifted).
    Prec.highest(
      EditorView.domEventHandlers({
        keydown: (event) => {
          bar.shifted = event.shiftKey;
          return false;
        },
      }),
    ),
    Prec.high(
      keymap.of([
        bind('find', () => bar.open(false)),
        bind('replace', () => bar.open(true)),
        bind('next', () => bar.step()),
        bind('previous', () => bar.previous()),
        bind('replace-all', () => bar.replaceAll(), FIND_SCOPE),
        { key: 'Escape', run: () => bar.close(), scope: both },
      ]),
    ),
    // The panel CodeMirror makes room for is the bar's placeholder: the bar is drawn outside.
    EditorView.theme({ '.cm-panels': { display: 'none' } }),
  ];
}
