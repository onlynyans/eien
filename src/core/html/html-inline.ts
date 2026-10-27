// Paste, inline: HTML's words and inline elements as Markdown. Emphasis,
// strikethrough and underline by Markdown's marks where they'd read as marks,
// else as the tags a note may hold; links, images and code; the rest as words,
// their mark characters held (./marks-in-words.ts) until the block is read.
// ./from-html.ts reads the blocks.

import { flanking } from '../markdown';
import { safeAddress } from './addresses';
import type { HtmlNode } from './html';
import { escapeLinkWords, hold, shown } from './marks-in-words';

/** All of an element's words, as written. */
export const textOf = (nodes: readonly HtmlNode[]): string =>
  nodes
    .map((node) =>
      node.kind === 'text' ? node.text : node.name === 'br' ? '\n' : textOf(node.children),
    )
    .join('');

/**
 * Words as Markdown: the characters that could make a mark held, and so
 * written as typed unless they'd read as one; in a link's words, its
 * brackets and backslashes escaped, as one could end the link.
 */
function escapeInline(text: string, inLink: boolean): string {
  const held = hold(text);
  return (
    (inLink ? escapeLinkWords(held) : held)
      // A "#" that would start a tag: the page showed a word, not a tag.
      .replace(/(?<=^|\s)#(?=[\p{L}\p{M}\p{N}_-])/gu, '\\#')
  );
}

/** A run of HTML whitespace as one space (no-break spaces kept). */
const collapse = (text: string) => text.replace(/[ \t\n\r\f]+/gu, ' ');

/** An element whose words are marked: by Markdown's marks where they'd read as marks, else its tag. */
interface Marked {
  /** "*", "**", "~~"; "" for one Markdown has no marks for (underline, sub, sup). */
  readonly marks: string;
  readonly tag: string;
  readonly inner: string;
}

const MARKED: Readonly<Record<string, { readonly marks: string; readonly tag: string }>> = {
  em: { marks: '*', tag: 'em' },
  i: { marks: '*', tag: 'em' },
  cite: { marks: '*', tag: 'em' },
  var: { marks: '*', tag: 'em' },
  strong: { marks: '**', tag: 'strong' },
  b: { marks: '**', tag: 'strong' },
  s: { marks: '~~', tag: 's' },
  del: { marks: '~~', tag: 's' },
  strike: { marks: '~~', tag: 's' },
  u: { marks: '', tag: 'u' },
  ins: { marks: '', tag: 'u' },
  // "^a b^" can't hold a space: these are always written as tags, which a note may hold.
  sub: { marks: '', tag: 'sub' },
  sup: { marks: '', tag: 'sup' },
};

/**
 * `part`'s words marked, its spaces left outside ("*word* next", never
 * "*word *next"). Marks are used only where Markdown would read them as
 * marks (its flanking rule, with `before` and `after` the characters beside
 * them): "scarf<em>]</em>" can't be "scarf*\\]*", so it stays a tag.
 */
function marked(part: Marked, before: string, after: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/u.exec(part.inner);
  const [, lead = '', words = '', trail = ''] = match ?? [];
  if (!words) return part.inner;
  const [marks, core] = bothOf(part.marks, words) ?? [part.marks, words];
  const opens = flanking(lead ? lead.slice(-1) : before, shown(core.slice(0, 1))).open;
  const closes = flanking(shown(core.slice(-1)), trail ? trail.slice(0, 1) : after).close;
  // Marks against marks of the same kind would run together ("*" round "*x*" reads as "**x**").
  const mark = marks.slice(0, 1);
  const runsTogether = mark !== '' && (core.startsWith(mark) || core.endsWith(mark));
  return marks && opens && closes && !runsTogether
    ? `${lead}${marks}${core}${marks}${trail}`
    : `${lead}<${part.tag}>${words}</${part.tag}>${trail}`;
}

/**
 * Bold round all of an italic, or italic round all of a bold, as one run of
 * three marks ("***both***"): the marks and the words between them, or null.
 */
function bothOf(marks: string, words: string): [string, string] | null {
  const other = marks === '*' ? '**' : marks === '**' ? '*' : '';
  if (!other || words.length <= 2 * other.length) return null;
  if (!words.startsWith(other) || !words.endsWith(other)) return null;
  const core = words.slice(other.length, -other.length);
  // Only when no other mark is inside: an escaped "\*" is the writer's own.
  return /^(?:[^*\\\s]|\\[\s\S])(?:[^*\\]|\\[\s\S])*$/u.test(core) && !/\s$/u.test(core)
    ? ['***', core]
    : null;
}

/** A link's address as Markdown can hold it. */
const destination = (url: string) =>
  /[\s()<>]/u.test(url) ? `<${url.replace(/[<>]/gu, '')}>` : url;

function part(node: HtmlNode, within: ReadonlySet<string>): string | Marked {
  if (node.kind === 'text') return escapeInline(collapse(node.text), within.has('a'));
  const kind = MARKED[node.name];
  // Italic inside italic is italic once: "<em><em>x</em></em>" is "*x*".
  if (kind && within.has(kind.tag)) return inline(node.children, within);
  if (kind) return { ...kind, inner: inline(node.children, new Set([...within, kind.tag])) };
  switch (node.name) {
    case 'br':
      return '\n';
    case 'code':
    case 'kbd':
    case 'samp':
    case 'tt': {
      const code = collapse(textOf(node.children));
      const fence = code.includes('`') ? '``' : '`';
      return code.trim() ? `${fence}${code}${fence}` : code;
    }
    case 'a': {
      const text = inline(node.children, new Set([...within, 'a']));
      const href = node.attrs.href?.trim() ?? '';
      return safeAddress(href) && text.trim() ? `[${text}](${destination(href)})` : text;
    }
    case 'img': {
      const src = node.attrs.src?.trim() ?? '';
      return safeAddress(src)
        ? `![${escapeInline(collapse(node.attrs.alt ?? ''), true)}](${destination(src)})`
        : '';
    }
    default:
      return inline(node.children, within);
  }
}

export function inline(
  nodes: readonly HtmlNode[],
  within: ReadonlySet<string> = new Set(),
): string {
  // Side by side, the same mark is one: "<em>a</em><em>b</em>" is "*ab*", never "*a**b*".
  const parts: (string | Marked)[] = [];
  for (const node of nodes) {
    const next = part(node, within);
    const last = parts[parts.length - 1];
    if (typeof next !== 'string' && typeof last === 'object' && last.tag === next.tag) {
      parts[parts.length - 1] = { ...last, inner: last.inner + next.inner };
    } else parts.push(next);
  }
  let out = '';
  parts.forEach((piece, i) => {
    if (typeof piece === 'string') {
      out += piece;
      return;
    }
    const next = parts[i + 1];
    // What follows a mark: words, or another element's mark (or tag), punctuation either way.
    const after =
      next === undefined
        ? ''
        : typeof next === 'string'
          ? shown(next.slice(0, 1))
          : /^\s/u.test(next.inner)
            ? ' '
            : '*';
    out += marked(piece, shown(out.slice(-1)), after);
  });
  return out;
}
