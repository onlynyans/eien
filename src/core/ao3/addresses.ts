// Link addresses for Copy for AO3 and Paste: where a link goes, as the
// note's Markdown says it (a reference defined below, a bare www. address),
// and whether AO3 should follow it at all.

import type { SyntaxNode, Tree } from '@lezer/common';
import { eienParser } from '../markdown';
import { decodeEntities } from './html';

/**
 * Addresses a link may go to: the web, mail, a place on the page, or a
 * relative one. Anything else (javascript:, data:, vbscript:) is words only.
 */
const SAFE_URL = /^(?:https?:|mailto:|#|\/|\.{0,2}\/|[^:/?#]+(?:[/?#]|$))/iu;

/**
 * Whether `url` may be followed. Spaces and control characters inside a
 * scheme ("java\tscript:") are what a browser ignores, so they're ignored
 * here too before it's judged.
 */
export const safeAddress = (url: string): boolean =>
  url !== '' && SAFE_URL.test(url.replace(/[\s\p{Cc}]/gu, ''));

/** Whether `url` goes to the web or to mail: all a book's links may go to (spec §8). */
export const webAddress = (url: string): boolean =>
  /^(?:https?:\/\/|mailto:)/iu.test(url.replace(/[\s\p{Cc}]/gu, ''));

/** A reference's label as CommonMark matches it: case and runs of spaces don't count. */
const labelKey = (label: string) => label.trim().replace(/\s+/gu, ' ').toLowerCase();

/** A link destination as written, its backslash escapes and entities read. */
export const destination = (written: string): string =>
  decodeEntities(written.replace(/^<|>$/gu, '').replace(/\\([!-/:-@[-`{-~])/gu, '$1'));

/** A bare address (a GFM autolink) as one a browser follows: www. to the web, an email to mail. */
export function bareAddress(url: string): string {
  if (/^www\./iu.test(url)) return `http://${url}`;
  if (/^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/u.test(url)) return `mailto:${url}`;
  return url;
}

/** The note's link references, "[label]: address", by label; the first of a label counts. */
export class References {
  readonly #byLabel = new Map<string, string>();

  constructor(tree: Tree, source: string) {
    tree.iterate({
      enter: (node) => {
        if (node.name !== 'LinkReference') return;
        const label = node.node.getChild('LinkLabel');
        const url = node.node.getChild('URL');
        if (!label || !url) return false;
        const key = labelKey(source.slice(label.from + 1, label.to - 1));
        if (!this.#byLabel.has(key))
          this.#byLabel.set(key, destination(source.slice(url.from, url.to)));
        return false;
      },
    });
  }

  /** Where the link `node` goes by reference ("[words][label]", "[label][]", "[label]"); null if nowhere. */
  of(node: SyntaxNode, source: string, words: string): string | null {
    const label = node.getChild('LinkLabel');
    const named = label ? source.slice(label.from + 1, label.to - 1) : '';
    return this.#byLabel.get(labelKey(named.trim() ? named : words)) ?? null;
  }
}

/**
 * The addresses of the images `body` (a note's text, front matter left out)
 * shows, as a book's writer reads them: written in place, or by a reference
 * the note defines. An image whose brackets name nothing isn't one.
 */
export function imageAddresses(body: string): string[] {
  const source = body.replace(/\r\n?/g, '\n');
  const tree = eienParser.parse(source);
  const references = new References(tree, source);
  const found = new Set<string>();
  tree.iterate({
    enter: (node) => {
      if (node.name !== 'Image') return;
      const marks = node.node.getChildren('LinkMark');
      const open = marks[0];
      const close = marks.find((mark) => source.slice(mark.from, mark.to) === ']');
      if (!open || !close) return;
      const url = node.node.getChild('URL');
      const address = url
        ? destination(source.slice(url.from, url.to))
        : references.of(node.node, source, source.slice(open.to, close.from));
      if (address !== null) found.add(address);
    },
  });
  return [...found];
}
