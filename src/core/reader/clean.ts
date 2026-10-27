// A story site's HTML as the reader may show it (spec §14). The site's HTML is
// read by Eien's own parser, its styles turned into the tags they mean (as a
// paste's are), then kept to what words and their shapes need: paragraphs,
// emphasis, quotes, lists, tables, scene breaks, links to the web and images
// from it. Nothing else of it survives: no script, handler, style, class, id
// or form, and no element the reader doesn't know. The reader builds its
// page from these nodes, never from HTML.

import { BLOCK, declarations, type HtmlElement, type HtmlNode, parseHtml, tidy } from '../html';

/** Elements the reader draws as themselves. */
export const KEPT = new Set([
  'p',
  'div',
  'br',
  'hr',
  'em',
  'i',
  'strong',
  'b',
  'u',
  's',
  'del',
  'ins',
  'sup',
  'sub',
  'small',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'a',
  'img',
  'abbr',
  'pre',
  'code',
  'table',
  'caption',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'details',
  'summary',
  'figure',
  'figcaption',
]);

/** Elements drawn as another that looks the same, so the reader has fewer to style. */
const AS: Readonly<Record<string, string>> = {
  center: 'div',
  section: 'div',
  article: 'div',
  header: 'div',
  footer: 'div',
  main: 'div',
  aside: 'div',
  address: 'div',
  strike: 's',
  cite: 'em',
  var: 'em',
  kbd: 'code',
  samp: 'code',
  tt: 'code',
  acronym: 'abbr',
};

/** Dropped with all they hold: controls and embedded things, which a story's words never are. */
const DROPPED = new Set([
  'button',
  'input',
  'select',
  'option',
  'textarea',
  'iframe',
  'frame',
  'object',
  'embed',
  'svg',
  'math',
  'audio',
  'video',
  'canvas',
  'map',
  'link',
  'meta',
  'base',
]);

/** Where a block may say its words sit. */
const ALIGNS = new Set(['left', 'right', 'center', 'justify']);
const ALIGNED = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'li',
  'td',
  'th',
  'caption',
  'figure',
  'figcaption',
  'dt',
  'dd',
]);

/** Spaces and control characters in a scheme are what a browser ignores, so they're ignored here. */
const bare = (url: string) => url.replace(/[\s\p{Cc}]/gu, '');

/** A link to the web or to mail; anything else (javascript:, data:, a relative one) is words only. */
const linkable = (url: string) => /^(?:https?:\/\/|mailto:)/iu.test(bare(url));

/** An image from the web, over https; any other is its words (the alt) only. */
const showable = (url: string) => /^https:\/\//iu.test(bare(url));

function alignOf(node: HtmlElement, name: string): string | undefined {
  if (!ALIGNED.has(name)) return undefined;
  if (node.name === 'center') return 'center';
  const said = (declarations(node.attrs.style ?? '').get('text-align') ?? node.attrs.align ?? '')
    .trim()
    .toLowerCase();
  return ALIGNS.has(said) ? said : undefined;
}

/** The attributes the reader keeps for `name`, from the site's `node`. */
function attrsFor(node: HtmlElement, name: string): Record<string, string> | null {
  const attrs: Record<string, string> = {};
  const align = alignOf(node, name);
  if (align) attrs.align = align;
  const title = node.attrs.title;
  if (title && (name === 'a' || name === 'abbr' || name === 'img')) attrs.title = title;
  if (name === 'a' && node.attrs.href && linkable(node.attrs.href))
    attrs.href = bare(node.attrs.href);
  if (name === 'img') {
    const src = node.attrs.src ?? '';
    if (!showable(src)) return null;
    attrs.src = bare(src);
    attrs.alt = node.attrs.alt ?? '';
  }
  return attrs;
}

function cleaned(nodes: readonly HtmlNode[]): HtmlNode[] {
  return nodes.flatMap((node): HtmlNode[] => {
    if (node.kind === 'text') return [node];
    if (DROPPED.has(node.name)) return [];
    const name = AS[node.name] ?? node.name;
    const children = cleaned(node.children);
    if (!KEPT.has(name)) return children;
    const attrs = attrsFor(node, name);
    if (attrs === null) {
      // An image that can't be shown: its words, where it stood.
      const alt = node.attrs.alt?.trim();
      return alt ? [{ kind: 'text', text: `[${alt}]` }] : [];
    }
    return [{ kind: 'element', name, attrs, children }];
  });
}

/** The site's `html`, kept to what the reader shows. */
export function cleanHtml(html: string): HtmlNode[] {
  return cleaned(tidy(parseHtml(html)));
}

/** The words of cleaned nodes, a line between blocks: what's counted. */
export function plainOf(nodes: readonly HtmlNode[]): string {
  return nodes
    .map((node) => {
      if (node.kind === 'text') return node.text;
      const inner = plainOf(node.children);
      return BLOCK.has(node.name) || node.name === 'br' ? `\n${inner}\n` : inner;
    })
    .join('');
}

export type { HtmlElement as CleanElement, HtmlNode as CleanNode };
