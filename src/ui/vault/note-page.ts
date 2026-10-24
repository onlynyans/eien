// A page for an open note: typing goes to its session, a [[link]] opens
// the note it names (a web address opens in the browser), and a title typed
// renames the note.

import { baseName, titleOf } from '../../core/paths';
import { tagChoices } from '../../core/tags';
import type { VaultBridge } from '../../platform/bridge';
import { PageView } from '../page/page';
import { copyImages } from './note-images';
import { crumbsOf, type OpenNote } from './open-note';
import type { Organizer } from './organize';
import type { VaultState } from './vault-state';

export interface NotePageParts {
  /** Say what happened, where the window says such things (./notice.ts). */
  tell(message: string): void;
  /** The page's note: made after the page, which it shows. */
  note(): OpenNote;
  readonly state: VaultState;
  readonly organizer: Organizer;
  /** Open the note at `path` on this page's pane: done once it shows. */
  openNote(path: string): Promise<void>;
  /** Run a file operation, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): void;
  /** Where images dropped or pasted into the note are written (./note-images.ts). */
  readonly vault: Pick<VaultBridge, 'writeNew'>;
  /** The page's ×, while the window is split: the page closes, its note as it is. */
  close(): void;
}

export function notePage(area: HTMLElement, parts: NotePageParts): PageView {
  const page: PageView = new PageView(area, {
    close: () => parts.close(),
    changed: (text) => parts.note().session?.edit(text),
    follow: (target) => {
      if (target.kind === 'url')
        window.open(target.value); // the main process opens it in the browser
      else {
        const path = parts.state.findByTitle(target.value);
        if (path) void parts.openNote(path);
      }
    },
    images: (files, at) => {
      const session = parts.note().session;
      if (!session) return;
      void copyImages(parts.vault, session.path, files, parts.tell).then((shown) => {
        // Put where it was dropped, if the note is still the one open; else the images wait in its folder.
        if (shown && parts.note().session === session)
          page.editor.insert(shown, at, at === null ? 'input.paste' : 'input.drop');
      });
    },
    tags: {
      choices: (typed, has) => tagChoices(parts.state.tags, has, typed),
      tell: (message) => parts.tell(message),
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
