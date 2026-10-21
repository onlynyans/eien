// A small, forgiving HTML reader for what's pasted (AO3's HTML, a web page,
// a notes app's text): elements and text, entities decoded. Not a browser:
// it never runs anything, and keeps no more of a page than its words and
// their shapes. Unclosed tags close with their parent; a block opening
// closes an open paragraph; <script> and <style> are dropped with what's in
// them; comments too.

import { NAMED_ENTITIES } from './entities';

export interface HtmlElement {
  readonly kind: 'element';
  readonly name: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: HtmlNode[];
}

export interface HtmlText {
  readonly kind: 'text';
  readonly text: string;
}

export type HtmlNode = HtmlElement | HtmlText;

/** Elements that never hold anything. */
const VOID = new Set(['br', 'hr', 'img', 'wbr', 'input', 'meta', 'link', 'col', 'area', 'source']);

/** Elements whose opening closes an open <p> (HTML's own rule, in short). */
const CLOSES_P = new Set([
  'p',
  'div',
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
  'pre',
  'hr',
  'table',
  'section',
  'article',
  'header',
  'footer',
  'dl',
  'figure',
]);

/**
 * Elements whose opening closes an open one of their family (HTML's implied
 * end tags): within the nearest container, the first of those still open.
 */
const IMPLIED: Readonly<Record<string, { closes: string[]; within: string[] }>> = {
  li: { closes: ['li'], within: ['ul', 'ol'] },
  dt: { closes: ['dt', 'dd'], within: ['dl'] },
  dd: { closes: ['dt', 'dd'], within: ['dl'] },
  td: { closes: ['td', 'th'], within: ['tr', 'table'] },
  th: { closes: ['td', 'th'], within: ['tr', 'table'] },
  tr: { closes: ['tr', 'td', 'th'], within: ['table', 'thead', 'tbody', 'tfoot'] },
  thead: { closes: ['thead', 'tbody', 'tfoot', 'tr', 'td', 'th'], within: ['table'] },
  tbody: { closes: ['thead', 'tbody', 'tfoot', 'tr', 'td', 'th'], within: ['table'] },
  tfoot: { closes: ['thead', 'tbody', 'tfoot', 'tr', 'td', 'th'], within: ['table'] },
};

/** How deep elements nest; deeper ones sit beside each other (a browser's parser stops at 512 too). */
const MAX_DEPTH = 512;

/** Dropped with everything in them. */
const DROPPED = new Set(['script', 'style', 'template', 'noscript', 'head', 'title']);

export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escapeAttr = (text: string) => escapeHtml(text).replace(/"/g, '&quot;');

/** What a page shows of `html`: its words (and images), without its tags. */
export const visible = (html: string) => html.replace(/<(?!img\b)[^>]*>/gu, '').trim();

/** Spaces, tabs and line ends trimmed: a no-break space is the writer's, and stays. */
export const trimSpaces = (text: string): string => text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/gu, '');

/** Decode the entities in `text`; an unknown one is kept as written. */
export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,31});/giu,
    (whole, body: string) => {
      if (body.startsWith('#')) {
        const code =
          body[1] === 'x' || body[1] === 'X'
            ? Number.parseInt(body.slice(2), 16)
            : Number(body.slice(1));
        // Not a character (a surrogate, past Unicode, a nul): the replacement character, as browsers do.
        if (
          !Number.isFinite(code) ||
          code === 0 ||
          code > 0x10ffff ||
          (code >= 0xd800 && code <= 0xdfff)
        ) {
          return '�';
        }
        return String.fromCodePoint(code);
      }
      return NAMED_ENTITIES.get(body) ?? whole;
    },
  );
}

const TOKEN =
  /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<![^>]*>?|<\?[^>]*>?|<\/([A-Za-z][A-Za-z0-9:-]*)\s*>|<([A-Za-z][A-Za-z0-9:-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>|[^<]+|</gu;

const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu;

function attrsOf(source: string): Record<string, string> {
  const attrs: Record<string, string> = Object.create(null);
  for (const match of source.matchAll(ATTR)) {
    const name = (match[1] as string).toLowerCase();
    if (!(name in attrs)) attrs[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

/** The elements and text of `html`. */
export function parseHtml(html: string): HtmlNode[] {
  const root: HtmlElement = { kind: 'element', name: '#root', attrs: {}, children: [] };
  const open: HtmlElement[] = [root];
  /** Inside a dropped element (its name), everything is skipped until it closes. */
  let dropping: string | null = null;
  const top = () => open[open.length - 1] as HtmlElement;
  const close = (name: string) => {
    const at = open.map((e) => e.name).lastIndexOf(name);
    if (at > 0) open.length = at; // what's still open inside it closes with it
  };
  for (const match of html.matchAll(TOKEN)) {
    const [token, closing, opening, attrs] = match;
    if (dropping) {
      if (closing?.toLowerCase() === dropping) dropping = null;
      continue;
    }
    if (closing) {
      const name = closing.toLowerCase();
      if (name === 'br')
        top().children.push({ kind: 'element', name: 'br', attrs: {}, children: [] });
      else close(name);
    } else if (opening) {
      const name = opening.toLowerCase();
      if (DROPPED.has(name)) {
        if (!token.endsWith('/>')) dropping = name;
        continue;
      }
      if (CLOSES_P.has(name)) close('p');
      const implied = IMPLIED[name];
      if (implied) {
        // A new item, cell or row closes the one before it, within the same list or table.
        const names = open.map((e) => e.name);
        const within = names.findLastIndex((n) => implied.within.includes(n));
        const at = names.findIndex((n, i) => i > within && implied.closes.includes(n));
        if (at > 0) open.length = at;
      }
      const element: HtmlElement = {
        kind: 'element',
        name,
        attrs: attrsOf(attrs ?? ''),
        children: [],
      };
      top().children.push(element);
      if (!VOID.has(name) && !token.endsWith('/>') && open.length < MAX_DEPTH) open.push(element);
    } else if (!token.startsWith('<!') && !token.startsWith('<?')) {
      // Text (a lone "<" is text too).
      top().children.push({ kind: 'text', text: decodeEntities(token) });
    }
  }
  return root.children;
}
