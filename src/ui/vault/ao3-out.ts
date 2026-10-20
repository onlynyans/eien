// Copy for AO3 and Export → AO3 HTML (spec §8): the open note (or what's
// chosen in it) as AO3's HTML, quotes and scene breaks as the vault's
// settings say, onto the clipboard or into a file the writer places.

import { toAo3Html } from '../../core/ao3';
import { baseName, titleOf } from '../../core/paths';
import type { OutBridge } from '../../platform/bridge';
import type { PageView } from '../page/page';
import { reasonOf } from '../reason';
import type { SettingsState } from '../settings/settings-state';
import type { OpenNote } from './open-note';

export interface Ao3Parts {
  readonly page: PageView;
  readonly note: OpenNote;
  readonly out: OutBridge;
  readonly settings: SettingsState;
  tell(message: string): void;
}

const NOTHING = 'Nothing to copy: the note has no words yet.';
const NOTHING_CHOSEN = 'Nothing to copy: what’s chosen has no words.';

/** Copy for AO3 and Export → AO3 HTML, for the open note. */
export interface Ao3Out {
  copy(): Promise<void>;
  export(): Promise<void>;
}

export function ao3Out(parts: Ao3Parts): Ao3Out {
  const html = (text: string, chosen?: { from: number; to: number }) =>
    toAo3Html(
      text,
      {
        quotes: parts.settings.values['typography.quotes'],
        sceneBreak: parts.settings.values['ao3.sceneBreak'],
      },
      chosen,
    );
  return {
    /** ⇧⌘C: the words chosen, or the whole note, onto the clipboard as AO3 HTML. */
    async copy(): Promise<void> {
      if (!parts.note.session) return;
      const { state } = parts.page.editor.view;
      const { from, to } = state.selection.main;
      try {
        // What's chosen is read with the whole note: its links' references, its front matter left out.
        const out = html(state.doc.toString(), from === to ? undefined : { from, to });
        if (!out) return parts.tell(from === to ? NOTHING : NOTHING_CHOSEN);
        await parts.out.copy(out, out);
        parts.tell(from === to ? 'Copied as AO3 HTML.' : 'Copied what’s chosen as AO3 HTML.');
      } catch (error) {
        parts.tell(`It couldn’t be copied: ${reasonOf(error)}`);
      }
    },

    /** File → Export AO3 HTML…: the whole note, saved where the writer chooses. */
    async export(): Promise<void> {
      const session = parts.note.session;
      if (!session) return;
      try {
        const out = html(session.text);
        if (!out) return parts.tell(NOTHING);
        const saved = await parts.out.saveAs(titleOf(baseName(session.path)), out);
        if (saved) parts.tell(`Saved as “${saved}”.`);
      } catch (error) {
        parts.tell(`It couldn’t be saved: ${reasonOf(error)}`);
      }
    },
  };
}
