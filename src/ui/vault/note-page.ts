// The page for the open note: typing goes to its session, a [[link]] opens
// the note it names (a web address opens in the browser), and a title typed
// renames the note.

import { baseName, titleOf } from '../../core/paths';
import { PageView } from '../page/page';
import type { SettingsState } from '../settings/settings-state';
import { crumbsOf, type OpenNote } from './open-note';
import type { Organizer } from './organize';
import type { VaultState } from './vault-state';

export interface NotePageParts {
  /** The open note: made after the page, which it shows. */
  note(): OpenNote;
  readonly state: VaultState;
  readonly organizer: Organizer;
  openNote(path: string): void;
  /** Run a file operation, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): void;
}

export function notePage(area: HTMLElement, parts: NotePageParts): PageView {
  const page: PageView = new PageView(area, {
    changed: (text) => parts.note().session?.edit(text),
    follow: (target) => {
      if (target.kind === 'url')
        window.open(target.value); // the main process opens it in the browser
      else {
        const path = parts.state.findByTitle(target.value);
        if (path) parts.openNote(path);
      }
    },
    rename: (typed) => {
      const path = parts.note().path;
      if (!path) return;
      parts.act(async () => {
        const to = await parts.organizer.renameNote(path, typed);
        page.retitle(titleOf(baseName(to ?? path)), crumbsOf(to ?? path));
        page.focus();
      });
    },
  });
  return page;
}

/** The page as the settings say: its zoom, and the quotes typed on it. Returns a function to stop. */
export function followSettings(page: PageView, settings: SettingsState): () => void {
  const follow = (values: SettingsState['values']) => {
    page.showZoom(values['page.zoom']);
    page.editor.setQuotes(values['typography.quotes']);
  };
  follow(settings.values);
  return settings.onChange(follow);
}
