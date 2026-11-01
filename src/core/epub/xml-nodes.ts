// A book's own XML files (container.xml, the package, the NCX, the nav) as
// core/html's parser reads them: it closes "/>", keeps a prefix in a name
// ("dc:title", "epub:type") and lowers every name's case. Here they're found
// by their local names, the prefix aside, as namespaces vary book to book.

import { type HtmlElement, type HtmlNode, parseHtml } from '../html';
import { xmlText } from './xml-text';

/** A name without its prefix: "dc:title" is "title". */
export const local = (name: string): string => name.slice(name.lastIndexOf(':') + 1);

/**
 * `nodes` with every element named by its local name: a chapter's
 * `<svg:style>` or `<html:script>` is dropped as `<style>` and `<script>` are.
 */
export function localNames(nodes: readonly HtmlNode[]): HtmlNode[] {
  return nodes.map((node) =>
    node.kind === 'text'
      ? node
      : { ...node, name: local(node.name), children: localNames(node.children) },
  );
}

/** The elements of a file's bytes (./xml-text.ts). */
export const xmlOf = (bytes: Uint8Array): HtmlNode[] => parseHtml(xmlText(bytes));

/** Every element under `nodes` named `name` (its local name), in document order. */
export function all(nodes: readonly HtmlNode[], name: string): HtmlElement[] {
  const found: HtmlElement[] = [];
  const walk = (list: readonly HtmlNode[]) => {
    for (const node of list) {
      if (node.kind !== 'element') continue;
      if (local(node.name) === name) found.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return found;
}

/** The first element under `nodes` named `name`, or null. */
export const first = (nodes: readonly HtmlNode[], name: string): HtmlElement | null =>
  all(nodes, name)[0] ?? null;

/** The elements directly in `node` named `name`. */
export const childrenNamed = (node: HtmlElement, name: string): HtmlElement[] =>
  node.children.filter(
    (child): child is HtmlElement => child.kind === 'element' && local(child.name) === name,
  );

/** An attribute by its local name ("epub:type" or "type"), or ''. */
export function attr(node: HtmlElement, name: string): string {
  const own = node.attrs[name];
  if (own !== undefined) return own;
  const key = Object.keys(node.attrs).find((key) => local(key) === name);
  return key === undefined ? '' : (node.attrs[key] ?? '');
}

/** The words in `node`, spaces run together and trimmed. */
export function wordsOf(node: HtmlNode): string {
  const text = (each: HtmlNode): string =>
    each.kind === 'text' ? each.text : each.children.map(text).join('');
  return text(node).replace(/\s+/gu, ' ').trim();
}
