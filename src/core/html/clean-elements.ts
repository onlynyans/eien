// What the cleaner (./clean.ts) keeps of an HTML page's elements, the same
// for every page it cleans: a story site's chapter, and later an EPUB's. Words
// and their shapes are kept; whatever could run, fetch or ask for input isn't.

/** Elements drawn as themselves. Read-only, as the drawing checks against it too. */
export const KEPT: ReadonlySet<string> = new Set([
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

/** Elements drawn as another that looks the same, so a page has fewer to style. */
export const AS: Readonly<Record<string, string>> = {
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

/** Dropped with all they hold: controls and embedded things, which words never are. */
export const DROPPED: ReadonlySet<string> = new Set([
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
export const ALIGNS: ReadonlySet<string> = new Set(['left', 'right', 'center', 'justify']);
export const ALIGNED: ReadonlySet<string> = new Set([
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

/**
 * The parts of a chapter an EPUB's stylesheet styles by name (#40), read off
 * the page by the caller's rules. A chapter's first line isn't one: it's a
 * matter of where a paragraph stands, not of what an element is.
 */
export const PARTS = ['chapter-title', 'scene-break', 'epigraph', 'plate', 'caption'] as const;
export type Part = (typeof PARTS)[number];

const PART_NAMES: ReadonlySet<string> = new Set(PARTS);

/** Whether `name` is one of PARTS: a caller's rules are checked, not trusted. */
export const isPart = (name: string): name is Part => PART_NAMES.has(name);
