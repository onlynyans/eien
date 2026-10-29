// Cleaned nodes (core/html/clean.ts) drawn: elements made one by one, never
// from HTML, so only what the cleaner kept can be on the page. The drawing
// checks again what it's handed that could run or fetch (an element the
// cleaner keeps, a link or an image's address of a kind a page may use, a
// part it knows), so a caller's rules that let something through still can't
// put it on the page; a title or an align, words and data, it takes as given. A scene break is Eien's
// own; a part is named for a stylesheet to style.

import { type CleanNode, imageWords, isPart, KEPT } from '../core/html';
import { h } from './dom';

export interface DrawOptions {
  /** Called with each link that goes somewhere: how it opens is the caller's. */
  readonly link?: (anchor: HTMLAnchorElement) => void;
  /**
   * Where an image is drawn from, given the src the cleaner kept (an EPUB's
   * path in its zip): the window's own copy, or null for its words. What it
   * gives is checked as any src is.
   */
  readonly image?: (src: string) => string | null;
}

/** Where a link may go: the web, mail, or a place on the page. */
const FOLLOWED = /^(?:https?:|mailto:|#)/iu;

/** Where an image may come from: the web over https, or the window's own copy of a file. */
const SHOWN = /^(?:https:|blob:)/iu;

/** Eien's scene break (theme/base.css), in a rule's place. */
const sceneBreak = () =>
  h('div', { class: 'scene-break', text: '***', attrs: { role: 'separator' } });

function drawn(node: CleanNode, options: DrawOptions): Node[] {
  if (node.kind === 'text') return [document.createTextNode(node.text)];
  const children = () => node.children.flatMap((child) => drawn(child, options));
  if (!KEPT.has(node.name)) return children();
  const element = node.name === 'hr' ? sceneBreak() : document.createElement(node.name);
  if (node.part && isPart(node.part)) element.dataset.part = node.part;
  if (node.name === 'hr') return [element];
  const { align, href, alt, title } = node.attrs;
  const src = node.attrs.src && options.image ? options.image(node.attrs.src) : node.attrs.src;
  if (align) element.dataset.align = align;
  if (title) element.title = title;
  if (element instanceof HTMLAnchorElement && href && FOLLOWED.test(href)) {
    element.setAttribute('href', href);
    options.link?.(element);
  }
  if (element instanceof HTMLImageElement) {
    // An image from anywhere else is its words, as the cleaner makes one it won't show.
    // Marked as Eien's, not the page's words: a place in a book counts only its own (#40).
    if (!src || !SHOWN.test(src)) {
      return imageWords(alt).map((words) => h('span', { class: 'image-words', text: words.text }));
    }
    element.setAttribute('alt', alt ?? '');
    element.setAttribute('loading', 'lazy');
    element.setAttribute('src', src);
  }
  element.append(...children());
  return [element];
}

/** `nodes`, drawn. */
export const drawClean = (
  nodes: readonly CleanNode[],
  options: DrawOptions = {},
): DocumentFragment => {
  const fragment = document.createDocumentFragment();
  fragment.append(...nodes.flatMap((node) => drawn(node, options)));
  return fragment;
};
