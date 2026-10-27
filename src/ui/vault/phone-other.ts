// The phone's other note (spec §10; one page, the phone's way): the back bar
// keeps the note you came from a tap away, at its right, ⇄ and its name. A
// tap goes back to it where you left it, and the note you were in becomes
// the other one, so working between a chapter and its notes is one tap, not
// back and forward again.

import { baseName, titleOf } from '../../core/paths';
import { h } from '../dom';
import { icon } from '../icons';
import type { NotePlace } from './open-note';
import type { Pages } from './pages';

export interface PhoneOtherOf {
  readonly pages: Pages;
  /** Whether a note is still in the vault, to go back to. */
  has(path: string): boolean;
  /** Whether the page is the pane in sight on a phone. */
  onPage(): boolean;
  /** Open `place`'s note where it was left, then draw the window. */
  open(place: NotePlace): Promise<void>;
}

export interface PhoneOther {
  /** The slip, for the back bar. */
  readonly element: HTMLButtonElement;
  /** The page's note changed, or the vault, or the pane in sight: the slip shows what it can go back to. */
  sync(): void;
}

export function phoneOther(of: PhoneOtherOf): PhoneOther {
  const name = h('span', { class: 'phone-bar__other-name' });
  const element = h(
    'button',
    {
      class: 'phone-bar__other',
      attrs: { type: 'button', hidden: true },
      on: { click: () => void (other && of.open(other)) },
    },
    icon('swap'),
    name,
  );
  /** Where the note you came from was left. */
  let other: NotePlace | null = null;
  /** The page's last note left, as last seen: a new one is the other note. */
  let seen: NotePlace | null = null;
  return {
    element,
    sync() {
      const { note } = of.pages.active;
      // The page beside, while there is one (so a page closed as the window folds is the other
      // note, where it was); else the note the page last left, when it leaves another.
      const beside = of.pages.other?.note.place;
      const fresh = note.left !== seen;
      seen = note.left;
      if (beside) other = beside;
      else if (fresh && seen) other = seen;
      const shown = other !== null && other.path !== note.path && of.has(other.path);
      element.hidden = !shown || !of.onPage();
      if (!shown || !other) return;
      const title = titleOf(baseName(other.path));
      name.textContent = title;
      element.setAttribute('aria-label', `Switch to the other note: ${title}`);
    },
  };
}
