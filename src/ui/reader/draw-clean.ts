// Cleaned nodes (core/reader/clean.ts) as the reader's page draws them:
// elements made one by one, never from HTML, so only what the cleaner kept
// can be on the page. A scene break is Eien's own; a link opens in a tab of
// its own, telling the site nothing of the reader.

import type { CleanNode } from '../../core/reader';
import { h } from '../dom';

/** Eien's scene break (theme/base.css), in a rule's place. */
const sceneBreak = () =>
  h('div', { class: 'scene-break', text: '***', attrs: { role: 'separator' } });

function drawn(node: CleanNode): Node {
  if (node.kind === 'text') return document.createTextNode(node.text);
  if (node.name === 'hr') return sceneBreak();
  const element = document.createElement(node.name);
  const { align, href, src, alt, title } = node.attrs;
  if (align) element.dataset.align = align;
  if (title) element.title = title;
  if (href) {
    element.setAttribute('href', href);
    element.setAttribute('target', '_blank');
    element.setAttribute('rel', 'noopener noreferrer');
  }
  if (src !== undefined) {
    element.setAttribute('alt', alt ?? '');
    element.setAttribute('loading', 'lazy');
    element.setAttribute('src', src);
  }
  element.append(...node.children.map(drawn));
  return element;
}

/** `nodes`, drawn. */
export const drawClean = (nodes: readonly CleanNode[]): DocumentFragment => {
  const fragment = document.createDocumentFragment();
  fragment.append(...nodes.map(drawn));
  return fragment;
};
