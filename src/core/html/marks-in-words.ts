// Paste: the page's own "[", "*", "<"… among its words, escaped only where
// they'd read as Markdown. While a paste is written they're held aside (a
// noncharacter each, which no page means), so the marks Paste writes itself
// are told from the page's; once a block is written, Eien's own parser reads
// it, and a held character it reads as a mark is escaped. "[1]", "a < b" and
// "5 * 3" stay as they were; "*word*" and "<b>" in the words are escaped.

import type { SyntaxNode, Tree } from '@lezer/common';
import { eienParser, footnoteRefs, isLink, referenceLabels } from '../markdown';

/** The characters that can make Markdown inside a line. */
const HELD = '\\`*_[]<~^=&!';
const FIRST = 0xfdd0;
const heldOf = new Map([...HELD].map((char, i) => [char, String.fromCharCode(FIRST + i)]));
const HELD_CHAR = new RegExp(
  `[${String.fromCharCode(FIRST)}-${String.fromCharCode(FIRST + HELD.length - 1)}]`,
  'gu',
);
const MARK_CHAR = new RegExp(`[${HELD.replace(/[\\[\]^]/gu, '\\$&')}]`, 'gu');
const LINK_ENDS = new RegExp(`[${heldOf.get('\\')}${heldOf.get('[')}${heldOf.get(']')}]`, 'gu');
const ANY_BRACKET = new RegExp(`[[\\]${heldOf.get('[')}${heldOf.get(']')}]`, 'gu');

/** Unicode's noncharacters U+FDD0–U+FDEF: no page means one, and held marks stand in them. */
export const NONCHARACTERS = /[\uFDD0-\uFDEF]/gu;

/** `text` with its mark characters held. */
export const hold = (text: string): string =>
  text.replace(MARK_CHAR, (char) => heldOf.get(char) ?? char);

/** The character a held one stands for (any other as it is): what the parser sees beside a mark. */
export const shown = (char: string): string => {
  const i = char.length === 1 ? char.charCodeAt(0) - FIRST : -1;
  return i >= 0 && i < HELD.length ? (HELD[i] as string) : char;
};

/** `text` with its held "\\", "[" and "]" escaped now: inside a link's words, where one could end it. */
export const escapeLinkWords = (text: string): string =>
  text.replace(LINK_ENDS, (char) => `\\${shown(char)}`);

/** Nodes whose first character makes them: a held one there is a mark, and nothing inside is looked at. */
const WHOLE = new Set([
  'HTMLTag',
  'HTMLBlock',
  'Comment',
  'CommentBlock',
  'ProcessingInstruction',
  'ProcessingInstructionBlock',
  'Entity',
  'Escape',
  'Autolink',
  'LinkReference',
]);

/** Nodes that are marks throughout. */
const isMark = (name: string) =>
  name.endsWith('Mark') ||
  name === 'TaskMarker' ||
  name === 'TableDelimiter' ||
  name === 'HorizontalRule';

/**
 * Whether the Link and Image nodes of `markdown` are ones on the page: with
 * an address (or its parentheses), naming a defined reference, or a
 * footnote's "[^label]". "[1]" and "[sic]" aren't.
 */
function linking(markdown: string, tree: Tree): (node: SyntaxNode) => boolean {
  const slice = (from: number, to: number) => markdown.slice(from, to);
  const references = referenceLabels(tree, slice);
  const footnotes = new Set(footnoteRefs(markdown).map((ref) => ref.from));
  // "[words]( )" has no address, but its "(" makes it a link all the same.
  const inline = (node: SyntaxNode) =>
    node.getChildren('LinkMark').some((mark) => slice(mark.from, mark.to) === '(');
  return (node) =>
    (node.name === 'Link' || node.name === 'Image') &&
    (isLink(node, slice, references) || inline(node) || footnotes.has(node.from));
}

/** The places in `markdown` that Eien reads as marks (of each "whole" node, its first). */
function markPlaces(markdown: string): Set<number> {
  const tree = eienParser.parse(markdown);
  const links = linking(markdown, tree);
  const places = new Set<number>();
  tree.iterate({
    enter(ref) {
      if (WHOLE.has(ref.name)) {
        places.add(ref.from);
        return false;
      }
      if (!isMark(ref.name)) return undefined;
      const parent = ref.node.parent;
      const ofLink = parent?.name === 'Link' || parent?.name === 'Image';
      if (ref.name !== 'LinkMark' || !ofLink || links(parent)) {
        for (let at = ref.from; at < ref.to; at++) places.add(at);
      }
      return false;
    },
  });
  return places;
}

/**
 * What the page shows of `markdown`, as Eien reads it: its elements and
 * words, an escaped character as the character, and brackets that link
 * nowhere as the words they are. Two blocks that show the same read the same.
 */
function showing(markdown: string): string {
  const tree = eienParser.parse(markdown);
  const links = linking(markdown, tree);
  const walk = (node: SyntaxNode): string => {
    if (node.name === 'Escape') return markdown.slice(node.from + 1, node.to);
    const words =
      node.name === 'Document' || ((node.name === 'Link' || node.name === 'Image') && !links(node));
    let out = '';
    let at = node.from;
    for (let child = node.firstChild; child; child = child.nextSibling) {
      out += markdown.slice(at, child.from);
      const asWords = words && (child.name === 'LinkMark' || child.name === 'LinkLabel');
      out += asWords ? markdown.slice(child.from, child.to) : walk(child);
      at = child.to;
    }
    out += markdown.slice(at, node.to);
    return words ? out : `<${node.name}>${out}</${node.name}>`;
  };
  return walk(tree.topNode);
}

/** `block` written out: each held character as itself, or escaped where `escaped` says (by its index among them). */
function written(block: string, escaped: (index: number) => boolean): string {
  let index = 0;
  return block.replace(HELD_CHAR, (char) => (escaped(index++) ? `\\${shown(char)}` : shown(char)));
}

/** How many times a block is read again for marks its escapes made: once or twice, as a rule. */
const ROUNDS = 6;

/**
 * Past this many brackets in one block, every held character is escaped
 * unread: the parser's time grows with the square of a paragraph's brackets.
 */
const MOST_BRACKETS = 400;

/**
 * A block of Paste's Markdown with its held characters written out: each as
 * itself, unless Eien would read it as a mark, then escaped. Should that
 * show anything other than escaping them all would, they're all escaped.
 */
export function settle(block: string): string {
  const all = written(block, () => true);
  if (all === block) return block;
  if ((block.match(ANY_BRACKET)?.length ?? 0) > MOST_BRACKETS) return all;
  const escaped = new Set<number>();
  for (let round = 0; round < ROUNDS; round++) {
    // Where each held character still written as itself is, by its index among them.
    const unescaped = new Map<number, number>();
    let index = 0;
    let at = 0;
    for (const char of block.split('')) {
      if (shown(char) !== char) {
        if (escaped.has(index)) at++;
        else unescaped.set(at, index);
        index++;
      }
      at++;
    }
    const markdown = written(block, (i) => escaped.has(i));
    const marked = [...markPlaces(markdown)].flatMap((place) => unescaped.get(place) ?? []);
    if (marked.length === 0) return showing(markdown) === showing(all) ? markdown : all;
    for (const i of marked) escaped.add(i);
  }
  return all;
}
