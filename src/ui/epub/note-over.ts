// A book's note over its page (#40, Phase 2b): a note's reference pressed
// shows the note beside it, in the book's own face, rather than taking the
// reader away to the end of the chapter or the book. It floats as a menu
// does (../menu/menu.ts: raised paper, the float shadow; one thing open,
// closed by a click elsewhere), takes the keyboard, and closes on Esc or as
// the page scrolls, the keyboard back on the reference. "Go to the note"
// follows the link, for a note too long to read here.

import type { ZipAddress } from '../../core/epub';
import { h } from '../dom';
import { float } from '../menu/menu';
import { catchLinks } from './book-links';
import { copyWords } from './book-words';

export interface NoteOverOf {
  /** The reference pressed: the note floats under it, and the keyboard comes back to it. */
  readonly reference: HTMLAnchorElement;
  /** The note's words, drawn. */
  readonly words: Node;
  /** The book's face, as its leaf wears it. */
  readonly face: string | undefined;
  /** The page's scroller: the note closes as it scrolls. */
  readonly scroller: HTMLElement;
  /** Go to the note itself. */
  go(): void;
  /** A link in the note pressed: it closes, and the link is followed as the page's are. */
  follow(anchor: HTMLAnchorElement, link: ZipAddress): void;
  /** The note gone, however it closed. */
  closed(): void;
}

/** The note shown; the close returned. */
export function noteOver(of: NoteOverOf): () => void {
  const mark = of.reference.textContent?.trim() ?? '';
  const words = h('div', { class: 'epub-chapter' }, of.words);
  const go = h('button', {
    class: 'word-button',
    text: 'Go to the note',
    attrs: { type: 'button' },
    on: {
      click: () => {
        close();
        of.go();
      },
    },
  });
  const panel = h(
    'div',
    {
      class: 'menu epub-note',
      attrs: { role: 'dialog', 'aria-label': mark ? `Note ${mark}` : 'Note', tabindex: '-1' },
    },
    words,
    go,
  );
  if (of.face) panel.dataset.face = of.face;
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  // Its own links are the book's: never the window's (./book-links.ts).
  catchLinks(panel, (anchor, link) => {
    close();
    of.follow(anchor, link);
  });
  const stopCopy = copyWords(panel);
  const scrolled = () => close();
  const close = float(panel, { opener: of.reference }, () => {
    of.scroller.removeEventListener('scroll', scrolled);
    stopCopy();
    if (!document.activeElement || document.activeElement === document.body) of.reference.focus();
    of.closed();
  });
  of.scroller.addEventListener('scroll', scrolled, { passive: true });
  panel.focus();
  return close;
}
