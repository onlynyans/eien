// An HTML page as Eien may show it: a story site's chapter in the browser
// extension (spec §14), and later an EPUB's (#40). The page is read by Eien's
// own parser, its styles turned into the tags they mean (as a paste's are),
// then kept to what words and their shapes need (./clean-elements.ts).
// Nothing else of it survives: no script, handler, style, class, id or form,
// and no element the drawing (ui/draw-clean.ts) doesn't know. Pages are drawn
// from these nodes, never from HTML.
//
// What differs between callers is where a link may go and an image come from
// (the web for a story; the book's own zip for an EPUB), and which parts of a
// chapter have names: those are the caller's rules.

import { ALIGNED, ALIGNS, AS, DROPPED, isPart, KEPT, type Part } from './clean-elements';
import { declarations } from './css';
import { type HtmlElement, type HtmlNode, type HtmlText, parseHtml } from './html';
import { BLOCK, tidy } from './tidy';

export interface CleanRules {
  /** Where a link goes, from its href as the page wrote it; null keeps only its words. */
  readonly link: (href: string) => string | null;
  /** What an image is drawn from, from its src as the page wrote it; null shows only its words (the alt). */
  readonly image: (src: string) => string | null;
  /**
   * The part a kept element plays, read off the page's element after it's
   * tidied (its class, epub:type and the rest still on it), and `name`, what
   * it's kept as. Anything but one of PARTS is ignored.
   */
  readonly part?: (source: HtmlElement, name: string) => string | null;
}

export interface CleanElement {
  readonly kind: 'element';
  /** One of KEPT. */
  readonly name: string;
  /** Only align, title, href, src and alt; href and src as the rules gave them. */
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: CleanNode[];
  readonly part?: Part;
}

export type CleanNode = CleanElement | HtmlText;

function alignOf(node: HtmlElement, name: string): string | undefined {
  if (!ALIGNED.has(name)) return undefined;
  if (node.name === 'center') return 'center';
  const said = (declarations(node.attrs.style ?? '').get('text-align') ?? node.attrs.align ?? '')
    .trim()
    .toLowerCase();
  return ALIGNS.has(said) ? said : undefined;
}

/** The attributes kept for `name`, from the page's `node`; null for an image the rules won't show. */
function attrsFor(
  node: HtmlElement,
  name: string,
  rules: CleanRules,
): Record<string, string> | null {
  const attrs: Record<string, string> = {};
  const align = alignOf(node, name);
  if (align) attrs.align = align;
  const title = node.attrs.title;
  if (title && (name === 'a' || name === 'abbr' || name === 'img')) attrs.title = title;
  if (name === 'a' && node.attrs.href) {
    const href = rules.link(node.attrs.href);
    if (href !== null) attrs.href = href;
  }
  if (name === 'img') {
    const src = rules.image(node.attrs.src ?? '');
    if (src === null) return null;
    attrs.src = src;
    attrs.alt = node.attrs.alt ?? '';
  }
  return attrs;
}

/** An image that can't be shown, as its words where it stood: `[alt]`, or nothing with no alt. */
export function imageWords(alt: string | undefined): HtmlText[] {
  const words = alt?.trim();
  return words ? [{ kind: 'text', text: `[${words}]` }] : [];
}

function partOf(node: HtmlElement, name: string, rules: CleanRules): Part | undefined {
  const part = rules.part?.(node, name);
  return part && isPart(part) ? part : undefined;
}

function cleaned(nodes: readonly HtmlNode[], rules: CleanRules): CleanNode[] {
  return nodes.flatMap((node): CleanNode[] => {
    if (node.kind === 'text') return [node];
    if (DROPPED.has(node.name)) return [];
    const name = AS[node.name] ?? node.name;
    const children = cleaned(node.children, rules);
    if (!KEPT.has(name)) return children;
    const attrs = attrsFor(node, name, rules);
    if (attrs === null) return imageWords(node.attrs.alt);
    const part = partOf(node, name, rules);
    return [{ kind: 'element', name, attrs, children, ...(part ? { part } : {}) }];
  });
}

/** The page's `html`, kept to what may be shown under `rules`. */
export function cleanHtml(html: string, rules: CleanRules): CleanNode[] {
  return cleaned(tidy(parseHtml(html)), rules);
}

/** The words of cleaned nodes, a line between blocks: what's counted. */
export function plainOf(nodes: readonly CleanNode[]): string {
  return nodes
    .map((node) => {
      if (node.kind === 'text') return node.text;
      const inner = plainOf(node.children);
      return BLOCK.has(node.name) || node.name === 'br' ? `\n${inner}\n` : inner;
    })
    .join('');
}
