// The right-click menu in the note (spec §4): the suggestions for a word
// spellcheck has underlined (macOS), then Cut, Copy and Paste. The window
// draws its own menus for rows; this is the editor's, and a selection's.

import { type BrowserWindow, Menu } from 'electron';
import { contextMenuOf } from './context-menu-of';

export function serveContextMenu(window: BrowserWindow): void {
  const contents = window.webContents;
  contents.on('context-menu', (_event, params) => {
    const template = contextMenuOf(params, {
      replace: (word) => contents.replaceMisspelling(word),
      learn: (word) => contents.session.addWordToSpellCheckerDictionary(word),
    });
    if (template.length > 0) Menu.buildFromTemplate(template).popup({ window });
  });
}
