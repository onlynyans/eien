// A link in the note (backlog #38), with no window of its own: the link at a
// place, its words and where it goes; an edit to them as one step of the
// note's history; the link taken off, its words kept; and where it leads, for
// the editor's `follow`. The three ways of showing a link (./link-card.ts,
// ./link-inline.ts, ./link-bar.ts) only draw it and come here.

import { isolateHistory } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import type { EditorState, TransactionSpec } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import {
  asAddress,
  isAddress,
  linkAddress,
  linkWords,
  webLink,
  wikiLink,
  wikiParts,
} from '../../core/markdown';

/**
 * How it's written: `[[note|words]]`, `[words](address)`, `<address>`, or an
 * address bare in the text.
 */
export type LinkForm = 'wiki' | 'inline' | 'angle' | 'bare';

interface Span {
  readonly from: number;
  readonly to: number;
}

export interface Link extends Span {
  readonly form: LinkForm;
  /** To a note in the vault, by its name, or to the web (or mail). */
  readonly kind: 'note' | 'web';
  /** The words the page shows, as written (their marks kept). */
  readonly words: string;
  /** A note's name, or an address. */
  readonly goesTo: string;
  /** Where the words are, and where it goes, in the text. */
  readonly wordsAt: Span;
  readonly goesAt: Span;
}

/** Where a link leads, as the editor's `follow` hears it. */
export interface LinkTarget {
  readonly kind: 'url' | 'note';
  readonly value: string;
}

/** A link's words or where it goes, or both, as the writer typed them. */
export interface LinkChange {
  readonly words?: string;
  readonly goesTo?: string;
}

const span = (node: SyntaxNode | Span): Span => ({ from: node.from, to: node.to });

/** The link of `node`'s kind starting at `node`, or null. */
function linkOf(state: EditorState, node: SyntaxNode): Link | null {
  const text = (at: Span) => state.doc.sliceString(at.from, at.to);
  if (node.name === 'WikiLink') {
    const inside = { from: node.from + 2, to: node.to - 2 };
    const { note } = wikiParts(text(inside));
    const goesAt = { from: inside.from, to: inside.from + note.length };
    const wordsAt = goesAt.to < inside.to ? { from: goesAt.to + 1, to: inside.to } : goesAt;
    return {
      ...span(node),
      form: 'wiki',
      kind: 'note',
      words: text(wordsAt),
      goesTo: note.trim(),
      wordsAt,
      goesAt,
    };
  }
  if (node.name === 'Link') {
    // "[words][ref]" goes where the reference says, on another line: not yet (links.md, Open).
    const url = node.getChild('URL');
    const [open, close] = node.getChildren('LinkMark');
    if (!url || !open || !close) return null;
    // <address with spaces>: the brackets are the link's, not the address's.
    const angled = text(url).startsWith('<') && text(url).endsWith('>');
    const goesAt = angled ? { from: url.from + 1, to: url.to - 1 } : span(url);
    const wordsAt = { from: open.to, to: close.from };
    return {
      ...span(node),
      form: 'inline',
      kind: 'web',
      words: text(wordsAt),
      goesTo: text(goesAt),
      wordsAt,
      goesAt,
    };
  }
  const autolink = node.name === 'Autolink';
  if (autolink || (node.name === 'URL' && !OWNED.has(node.parent?.name ?? '') && !inImage(node))) {
    const url = autolink ? node.getChild('URL') : node;
    if (!url) return null;
    const at = span(url);
    return {
      ...span(node),
      form: autolink ? 'angle' : 'bare',
      kind: 'web',
      words: text(at),
      goesTo: text(at),
      wordsAt: at,
      goesAt: at,
    };
  }
  return null;
}

/** A URL inside these is theirs: the link round it is found as its parent. */
const OWNED = new Set(['Link', 'Autolink']);

/** An image's address is the picture's, not a link's. */
const inImage = (node: SyntaxNode): boolean =>
  node.parent?.name === 'Image' || node.parent?.parent?.name === 'Image';

/** The link at `pos`, looking at the character after it (`side` 1) or before it (-1). */
export function linkAt(state: EditorState, pos: number, side: 1 | -1 = 1): Link | null {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side); node; ) {
    const link = linkOf(state, node);
    if (link) return link;
    node = node.parent;
  }
  return null;
}

/**
 * The link the caret at `head` is in: inside its marks, so a caret just
 * after `[[note]]` or `[words](…)` is the next word's. A bare address has no
 * closing mark: its end is still in it.
 */
export function caretLink(state: EditorState, head: number): Link | null {
  const link = linkAt(state, head, 1) ?? linkAt(state, head, -1);
  if (!link || head <= link.from) return null;
  return head < link.to || (head === link.to && link.form === 'bare') ? link : null;
}

/** Where `link` leads, for the editor's `follow`. */
export const targetOf = (link: Link): LinkTarget =>
  link.kind === 'note'
    ? { kind: 'note', value: link.goesTo }
    : { kind: 'url', value: asAddress(link.goesTo) };

/** Whether `typed` names the web rather than a note: an address, unless a note has that very name. */
const toWeb = (typed: string, isNote: (name: string) => boolean): boolean =>
  isAddress(typed) && !isNote(typed);

/** One step of the history, the writer's own (a link edited from its tools is typing, of a kind). */
const step = (spec: TransactionSpec): TransactionSpec => ({
  ...spec,
  userEvent: 'input.link',
  annotations: isolateHistory.of('full'),
  scrollIntoView: true,
});

/**
 * `link` with its words or where it goes changed, as one step of the
 * history; null when nothing changes. Where it goes says the kind: an
 * address the web, else a note (`isNote` asks the vault about a name that
 * could be either). An empty "goes to" keeps the old one; empty words are the
 * note's name, or the address. Written in place where the kind and form
 * stay, so a title or the words' marks are kept; written anew where they
 * don't. The caret ends in the link's words, so its tools stay.
 */
export function linkEdit(
  state: EditorState,
  link: Link,
  change: LinkChange,
  isNote: (name: string) => boolean = () => false,
): TransactionSpec | null {
  const words = change.words ?? link.words;
  const typed = change.goesTo?.trim() || link.goesTo;
  const web = toWeb(typed, isNote);
  const goesTo = web ? asAddress(typed) : typed;
  const wordsChanged = words !== link.words;
  if (!wordsChanged && goesTo === link.goesTo && web === (link.kind === 'web')) return null;

  if (link.form === 'wiki' && !web) {
    // A [[note]] renamed takes its new name as its words, as it showed the old.
    const said = !wordsChanged && link.words === link.goesTo ? goesTo : words;
    const source = wikiLink(goesTo, said);
    return step({
      changes: { from: link.from, to: link.to, insert: source },
      selection: { anchor: link.from + source.length - 2 },
    });
  }
  if (link.form === 'inline' && web) {
    const changes = [];
    if (wordsChanged) changes.push({ ...link.wordsAt, insert: linkWords(words.trim() || goesTo) });
    if (goesTo !== link.goesTo) {
      const angled = link.goesAt.from > link.wordsAt.to + 2; // "](<" before it
      const at = angled ? { from: link.goesAt.from - 1, to: link.goesAt.to + 1 } : link.goesAt;
      changes.push({ ...at, insert: linkAddress(goesTo) });
    }
    return step({
      changes,
      selection: { anchor: state.changes(changes).mapPos(link.wordsAt.to, -1) },
    });
  }
  if ((link.form === 'angle' || link.form === 'bare') && web && !wordsChanged) {
    // Its words are its address: the address alone changes.
    return step({
      changes: { ...link.goesAt, insert: goesTo },
      selection: { anchor: link.goesAt.from + goesTo.length },
    });
  }
  // The kind or the form changes: written anew.
  const source = web ? webLink(words, goesTo) : wikiLink(goesTo, words);
  const wordsEnd = web
    ? link.from + 1 + linkWords(words.trim() || goesTo).length
    : link.from + source.length - 2;
  return step({
    changes: { from: link.from, to: link.to, insert: source },
    selection: { anchor: wordsEnd },
  });
}

/** Whether `link` can be taken off: an address standing as its own words is a link however it's written. */
export const canTakeOff = (link: Link): boolean => link.form === 'wiki' || link.form === 'inline';

/** `link` taken off, its words kept as they read (a wiki link's, or the name), as one step. */
export function linkOff(link: Link): TransactionSpec | null {
  if (!canTakeOff(link)) return null;
  return step({
    changes: { from: link.from, to: link.to, insert: link.words },
    selection: { anchor: link.from + link.words.length },
  });
}
