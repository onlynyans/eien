// Pasted HTML as it's meant, before it's read as Markdown. Some editors mark
// words by their style, not a tag (Google Docs: <span style="font-weight:700">),
// and some wrap blocks in an inline element (Google Docs wraps a whole paste
// in <b style="font-weight:normal">). Styles become the tags they mean, a
// style that undoes its tag undoes it, and an inline element round blocks
// goes inside each of them, so paragraphs stay paragraphs. What the page
// hid stays out; line ends it showed (white-space: pre-wrap) stay in; Word's
// lists become lists.

import { declarations } from './css';
import type { HtmlElement, HtmlNode } from './html';
import { wordLists } from './word-lists';

/** Elements that are blocks, or a table's cells: an inline element round them goes inside. */
export const BLOCK = new Set([
  'p',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'aside',
  'nav',
  'figure',
  'figcaption',
  'address',
  'center',
  'dl',
  'dt',
  'dd',
  'details',
  'summary',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'ul',
  'ol',
  'li',
  'pre',
  'hr',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
]);
const STRUCTURE = new Set([...BLOCK, 'td', 'th', 'caption']);

/** The tags each style property speaks for. */
const BOLD = new Set(['b', 'strong']);
const ITALIC = new Set(['i', 'em', 'cite', 'var']);
const STRUCK = new Set(['s', 'del', 'strike']);
const UNDERLINED = new Set(['u', 'ins']);

const element = (name: string, children: HtmlNode[]): HtmlElement => ({
  kind: 'element',
  name,
  attrs: {},
  children,
});

/** Where an element is: in a link (whose underline is the link's), a heading (bold already), lines kept. */
interface Within {
  readonly link: boolean;
  readonly heading: boolean;
  readonly lines: boolean;
}

/** `node` as its style says: its own mark undone if the style says so, and the style's marks added. */
function styled(node: HtmlElement, css: Map<string, string>, within: Within): HtmlElement {
  const weight = css.get('font-weight');
  const bold = weight === undefined ? undefined : /^(?:bold|bolder|[6-9]\d\d)$/u.test(weight);
  const fontStyle = css.get('font-style');
  const italic = fontStyle === undefined ? undefined : /^(?:italic|oblique)/u.test(fontStyle);
  const line = css.get('text-decoration-line') ?? css.get('text-decoration');
  const struck = line === undefined ? undefined : line.includes('line-through');
  // A link's underline is the link's, not the writer's.
  const underlined = line === undefined || within.link ? undefined : line.includes('underline');
  const undone =
    (bold === false && BOLD.has(node.name)) ||
    (italic === false && ITALIC.has(node.name)) ||
    (struck === false && STRUCK.has(node.name)) ||
    (underlined === false && UNDERLINED.has(node.name));
  const name = undone ? 'span' : node.name;
  const align = css.get('vertical-align');
  const added = [
    bold && !BOLD.has(name) && !within.heading ? 'strong' : '',
    italic && !ITALIC.has(name) ? 'em' : '',
    struck && !STRUCK.has(name) ? 's' : '',
    underlined && !UNDERLINED.has(name) ? 'u' : '',
    align === 'super' ? 'sup' : align === 'sub' ? 'sub' : '',
  ].filter(Boolean);
  const children = added.reduceRight<HtmlNode[]>(
    (inner, tag) => [element(tag, inner)],
    [...node.children],
  );
  return { ...node, name, children };
}

/** Hidden from the reader: by its style, or AO3's "landmark" headings (there for screen readers). */
const hidden = (node: HtmlElement, css: Map<string, string>) =>
  css.get('display') === 'none' ||
  css.get('visibility') === 'hidden' ||
  /(?:^|\s)landmark(?:\s|$)/u.test(node.attrs.class ?? '');

/** White-space values that show a text's line ends. */
const KEEPS_LINES = new Set(['pre', 'pre-wrap', 'pre-line', 'break-spaces']);

function restyle(nodes: readonly HtmlNode[], within: Within): HtmlNode[] {
  return nodes.flatMap((node): HtmlNode[] => {
    if (node.kind === 'text') {
      if (!within.lines || !node.text.includes('\n')) return [node];
      // Line ends the page showed: line breaks, as the page's <br> would be.
      return node.text
        .split('\n')
        .flatMap((text, i): HtmlNode[] => [
          ...(i > 0 ? [element('br', [])] : []),
          ...(text ? [{ kind: 'text' as const, text }] : []),
        ]);
    }
    const css = declarations(node.attrs.style ?? '');
    if (hidden(node, css)) return [];
    const inside = {
      link: within.link || node.name === 'a',
      heading: within.heading || /^h[1-6]$/u.test(node.name),
      lines:
        KEEPS_LINES.has(css.get('white-space') ?? '') || (within.lines && !css.has('white-space')),
    };
    const restyled = { ...node, children: restyle(node.children, inside) };
    return [css.size ? styled(restyled, css, inside) : restyled];
  });
}

/** The mark each inline element puts on its words; one with none (span, font) is only words. */
const MARK_OF: Readonly<Record<string, string>> = {
  b: 'strong',
  strong: 'strong',
  i: 'em',
  em: 'em',
  cite: 'em',
  var: 'em',
  s: 's',
  del: 's',
  strike: 's',
  u: 'u',
  ins: 'u',
  sub: 'sub',
  sup: 'sup',
  code: 'code',
  kbd: 'code',
  samp: 'code',
  tt: 'code',
  a: 'a',
};

const holds = new WeakMap<HtmlElement, boolean>();

/** Whether a block (or a cell) is anywhere under `node`; each element is looked at once. */
function holdsBlock(node: HtmlElement): boolean {
  let known = holds.get(node);
  if (known === undefined) {
    known = node.children.some(
      (child) => child.kind === 'element' && (STRUCTURE.has(child.name) || holdsBlock(child)),
    );
    holds.set(node, known);
  }
  return known;
}

/** `run`, inside the elements `around` (the outermost first). */
const wrapped = (run: HtmlNode[], around: readonly HtmlElement[]): HtmlNode[] =>
  run.every((node) => node.kind === 'text' && !node.text.trim())
    ? run
    : around.reduceRight<HtmlNode[]>((inner, outer) => [{ ...outer, children: inner }], run);

/**
 * No inline element holds a block: one that did goes inside its blocks
 * instead, round each run of their words. `around` are the elements it's
 * inside, one for each mark: a run of unclosed <font>s or <b>s, as old HTML
 * leaves them, wraps nothing more.
 */
function spread(nodes: readonly HtmlNode[], around: readonly HtmlElement[]): HtmlNode[] {
  const out: HtmlNode[] = [];
  let run: HtmlNode[] = [];
  const flush = () => {
    if (run.length) out.push(...wrapped(run, around));
    run = [];
  };
  for (const node of nodes) {
    if (node.kind === 'text' || (!STRUCTURE.has(node.name) && !holdsBlock(node))) {
      run.push(node);
      continue;
    }
    flush();
    if (STRUCTURE.has(node.name)) {
      out.push({ ...node, children: spread(node.children, around) });
      continue;
    }
    const mark = MARK_OF[node.name];
    const keep =
      mark !== undefined &&
      (mark !== 'a' || Boolean(node.attrs.href)) &&
      !around.some((outer) => MARK_OF[outer.name] === mark);
    out.push(...spread(node.children, keep ? [...around, node] : around));
  }
  flush();
  return out;
}

/** `nodes` with their styles as tags, and their inline elements inside their blocks. */
export const tidy = (nodes: readonly HtmlNode[]): HtmlNode[] =>
  spread(restyle(wordLists(nodes), { link: false, heading: false, lines: false }), []);
