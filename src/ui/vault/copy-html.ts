// Copy as HTML (spec §8): the open note (or what's chosen in it) as
// HTML, quotes and scene breaks as the vault's settings say, onto the
// clipboard. Export → HTML is ./exports.ts's, with the other exports.

import { toHtml } from '../../core/html';
import type { OutBridge } from '../../platform/bridge';
import { reasonOf } from '../reason';
import type { SettingsState } from '../settings/settings-state';
import type { NoteSide } from './pages';

export interface HtmlCopyParts {
  /** The active page and its note, or null when it holds something else. */
  active(): Pick<NoteSide, 'page' | 'note'> | null;
  readonly out: OutBridge;
  readonly settings: SettingsState;
  tell(message: string): void;
}

const NOTHING = 'Nothing to copy: the note has no words yet.';
const NOTHING_CHOSEN = 'Nothing to copy: what’s chosen has no words.';

/** Copy as HTML, for the active page's note. */
export interface HtmlCopy {
  copy(): Promise<void>;
}

export function htmlCopy(parts: HtmlCopyParts): HtmlCopy {
  const html = (text: string, chosen?: { from: number; to: number }) =>
    toHtml(
      text,
      {
        quotes: parts.settings.values['typography.quotes'],
        sceneBreak: parts.settings.values['html.sceneBreak'],
      },
      chosen,
    );
  return {
    /** ⇧⌘C: the words chosen, or the whole note, onto the clipboard as HTML. */
    async copy(): Promise<void> {
      const on = parts.active();
      if (!on?.note.session) return;
      const { state } = on.page.editor.view;
      const { from, to } = state.selection.main;
      try {
        // What's chosen is read with the whole note: its links' references, its front matter left out.
        const out = html(state.doc.toString(), from === to ? undefined : { from, to });
        if (!out) return parts.tell(from === to ? NOTHING : NOTHING_CHOSEN);
        await parts.out.copy(out, out);
        parts.tell(from === to ? 'Copied as HTML.' : 'Copied what’s chosen as HTML.');
      } catch (error) {
        parts.tell(`It couldn’t be copied: ${reasonOf(error)}`);
      }
    },
  };
}
