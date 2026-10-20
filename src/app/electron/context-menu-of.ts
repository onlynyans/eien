// The right-click menu's choices (spec §4), built from what was clicked on:
// the suggestions for a word spellcheck has underlined (macOS), then Cut,
// Copy and Paste; a selection elsewhere, Copy. ./context-menu.ts shows it.

import type { MenuItemConstructorOptions } from 'electron';

/** What a right-click is on, as Electron tells it. */
export interface ClickedOn {
  readonly isEditable: boolean;
  readonly selectionText: string;
  readonly misspelledWord: string;
  readonly dictionarySuggestions: readonly string[];
}

export interface SpellingActions {
  replace(word: string): void;
  learn(word: string): void;
}

/** The menu for a right-click on `on`; none (nothing to offer) is an empty list. */
export function contextMenuOf(on: ClickedOn, act: SpellingActions): MenuItemConstructorOptions[] {
  if (!on.isEditable) return on.selectionText ? [{ role: 'copy' }] : [];
  const spelling: MenuItemConstructorOptions[] = on.misspelledWord
    ? [
        ...(on.dictionarySuggestions.length
          ? on.dictionarySuggestions.map((word) => ({
              label: word,
              click: () => act.replace(word),
            }))
          : [{ label: 'No Guesses Found', enabled: false }]),
        { type: 'separator' },
        { label: 'Learn Spelling', click: () => act.learn(on.misspelledWord) },
        { type: 'separator' },
      ]
    : [];
  return [...spelling, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }];
}
