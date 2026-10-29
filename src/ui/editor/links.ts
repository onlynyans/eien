// Following a link in the note: ⌘-click (Ctrl-click off a Mac) in Live and
// Source, a plain click in Reading. A web address or a [[note]] by its title.

import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { EditorMode } from './editor';
import { type LinkTarget, linkAt as linkIn, targetOf } from './link-core';
import { MAC } from './link-presenter';

/** A click with ⌘ on a Mac, or Ctrl elsewhere (Ctrl-click on a Mac is the context menu). */
export const modClick = (event: MouseEvent): boolean =>
  event.button === 0 && (MAC ? event.metaKey : event.ctrlKey);

/** The link under the pointer, as the link core finds it (./link-core.ts). */
export function linkAt(view: EditorView, event: MouseEvent): LinkTarget | null {
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  const link = pos === null ? null : linkIn(view.state, pos);
  return link ? targetOf(link) : null;
}

/** Links followed: ⌘-click on the press, or, in Reading (`mode`), a plain click. */
export const linkFollowing = (
  follow: (target: LinkTarget) => void,
  mode: () => EditorMode,
): Extension => {
  const followed = (event: MouseEvent, view: EditorView) => {
    const target = linkAt(view, event);
    if (!target) return false;
    event.preventDefault();
    follow(target);
    return true;
  };
  return EditorView.domEventHandlers({
    // ⌘-click follows on the press, before the caret moves: in Live a caret on
    // the link's line would show its marks and slide the words from under the pointer.
    mousedown: (event, view) => modClick(event) && followed(event, view),
    // In Reading a plain click follows, as on a page; nothing there moves.
    click: (event, view) => mode() === 'reading' && !modClick(event) && followed(event, view),
  });
};
