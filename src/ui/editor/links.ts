// Following a link in the note: ⌘-click (Ctrl-click off a Mac) in Live and
// Source, a plain click in Reading. A web address or a [[note]] by its title.

import { syntaxTree } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { EditorEvents, EditorMode } from './editor';

const MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform);

/** A click with ⌘ on a Mac, or Ctrl elsewhere (Ctrl-click on a Mac is the context menu). */
export const modClick = (event: MouseEvent): boolean =>
  event.button === 0 && (MAC ? event.metaKey : event.ctrlKey);

/** The link under the pointer: a web address, or a [[note]] by its title. */
export function linkAt(
  view: EditorView,
  event: MouseEvent,
): Parameters<EditorEvents['follow']>[0] | null {
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (pos === null) return null;
  const text = (from: number, to: number) => view.state.doc.sliceString(from, to);
  for (let node = syntaxTree(view.state).resolveInner(pos, 1); node.parent; node = node.parent) {
    if (node.name === 'WikiLink') {
      return {
        kind: 'note',
        value:
          text(node.from + 2, node.to - 2)
            .split('|')[0]
            ?.trim() ?? '',
      };
    }
    const url =
      node.name === 'URL'
        ? node
        : node.name === 'Link' || node.name === 'Autolink'
          ? node.getChild('URL')
          : null;
    if (url) return { kind: 'url', value: text(url.from, url.to) };
  }
  return null;
}

/** Where a link leads: what `follow` hears. */
type Target = Parameters<EditorEvents['follow']>[0];

/** Links followed: ⌘-click on the press, or, in Reading (`mode`), a plain click. */
export const linkFollowing = (
  follow: (target: Target) => void,
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
