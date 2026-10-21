// The tags the page adds and takes off (backlog #13): those in the note's
// front matter, `tags:`, alone. Each edit changes only where the tags are
// written: every other key, comment and line stays byte for byte, and the
// text after the front matter is never touched, so a #tag typed in the
// words stays where the writer put it.

import { isMap, isScalar, isSeq, type Node, parse, parseDocument, type Scalar } from 'yaml';
import { frontMatterBlock } from '../text';
import { frontMatterTags, tagKey, tidyTag } from './tags';

/** An edit to the YAML: `insert` in place of what's between `from` and `to`. */
interface Splice {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
}

/** Front matter that isn't a plain map of keys (broken, a list, `tags:` twice): left alone. */
const BROKEN = Symbol('broken');

/** `tags:` in `yaml`: its value and where the key ends; null for no such key. */
function tagsPair(yaml: string): { value: Node | null; keyEnd: number } | null | typeof BROKEN {
  const doc = parseDocument(yaml, { uniqueKeys: false });
  if (doc.errors.length > 0) return BROKEN;
  if (doc.contents === null) return null;
  if (!isMap(doc.contents)) return BROKEN;
  const pairs = doc.contents.items.filter(
    (pair) => isScalar(pair.key) && pair.key.value === 'tags',
  );
  if (pairs.length > 1) return BROKEN; // which one counts is a reader's guess
  const pair = pairs[0];
  if (!pair) return null;
  return { value: (pair.value as Node | null) ?? null, keyEnd: (pair.key as Node).range?.[1] ?? 0 };
}

const isQuoted = (scalar: Scalar) =>
  scalar.type === 'QUOTE_DOUBLE' || scalar.type === 'QUOTE_SINGLE';

/** A string written in one line's way: plain or quoted, not a block scalar (| or >). */
const isLineString = (node: Node | null): node is Scalar<string> =>
  isScalar(node) &&
  typeof node.value === 'string' &&
  (node.type === 'PLAIN' || isQuoted(node as Scalar));

/** A block list item's line: where it starts, its indent, and just past it (its newline taken). */
function blockLine(yaml: string, item: Node): { indent: string; from: number; to: number } | null {
  const [start, end] = item.range ?? [0, 0];
  const lineStart = yaml.lastIndexOf('\n', start - 1) + 1;
  const dash = /^([ \t]*)-[ \t]+$/.exec(yaml.slice(lineStart, start));
  if (!dash) return null;
  const newline = yaml.indexOf('\n', end);
  // The last line has no newline after it: the one before it goes instead.
  const [from, to] =
    newline === -1 ? [Math.max(0, lineStart - 1), yaml.length] : [lineStart, newline + 1];
  return { indent: dash[1] ?? '', from, to };
}

/** A string's words as frontMatterTags splits them, each with where it is in `yaml`. */
function wordsOf(yaml: string, scalar: Scalar): { text: string; from: number; to: number }[] {
  const [start, end] = scalar.range ?? [0, 0];
  const from = isQuoted(scalar) ? start + 1 : start;
  const inside = yaml.slice(from, isQuoted(scalar) ? end - 1 : end);
  return [...inside.matchAll(/[^,\s]+/g)].map((match) => ({
    text: match[0],
    from: from + match.index,
    to: from + match.index + match[0].length,
  }));
}

const isTag = (key: string) => (written: string) => {
  const tag = tidyTag(written.trim());
  return tag !== null && tagKey(tag) === key;
};

function adding(yaml: string, tag: string): Splice | null {
  const pair = tagsPair(yaml);
  if (pair === BROKEN) return null;
  if (pair === null) {
    return yaml === ''
      ? { from: 0, to: 0, insert: `tags: [${tag}]` }
      : { from: yaml.length, to: yaml.length, insert: `\ntags: [${tag}]` };
  }
  const { value } = pair;
  if (value === null || (isScalar(value) && (value.value === null || value.value === ''))) {
    // `tags:` with nothing (or ~, null, '') after it: the list goes there.
    const colon = yaml.indexOf(':', pair.keyEnd);
    const [start, end] = value?.range ?? [colon + 1, colon + 1];
    if (colon < 0) return null;
    return start === end
      ? { from: start, to: end, insert: ` [${tag}]` }
      : { from: start, to: end, insert: `[${tag}]` };
  }
  const end = value.range?.[1] ?? 0;
  if (isSeq(value) && value.flow) {
    if (yaml[end - 1] !== ']') return null;
    const last = (value.items as Node[]).at(-1)?.range;
    return last
      ? { from: last[1], to: last[1], insert: `, ${tag}` }
      : { from: end - 1, to: end - 1, insert: tag };
  }
  if (isSeq(value)) {
    const items = value.items as Node[];
    const first = items[0] && blockLine(yaml, items[0]);
    const last = items.at(-1) && blockLine(yaml, items.at(-1) as Node);
    if (!first || !last) return null;
    const at = last.to === yaml.length ? yaml.length : last.to - 1;
    return { from: at, to: at, insert: `\n${first.indent}- ${tag}` };
  }
  if (isLineString(value)) {
    const at = isQuoted(value) ? end - 1 : end;
    // As the writer separates them: "a b" takes a space; "a, b", or one tag, a comma.
    const spaced = /\s/.test(value.value.trim()) && !value.value.includes(',');
    return { from: at, to: at, insert: spaced ? ` ${tag}` : `, ${tag}` };
  }
  return null;
}

/** Taking one writing of the tag `key` out of `yaml`. */
function removing(yaml: string, key: string): Splice | null {
  const pair = tagsPair(yaml);
  if (pair === BROKEN || pair === null) return null;
  const { value } = pair;
  if (isSeq(value)) {
    const items = value.items as Node[];
    const at = items.findIndex((item) => isLineString(item) && isTag(key)(item.value));
    const item = items[at];
    if (!item?.range) return null;
    if (!value.flow) {
      const line = blockLine(yaml, item);
      return line && { from: line.from, to: line.to, insert: '' };
    }
    // Its comma goes with it: the one before it, or for the first, the one after.
    const before = items[at - 1]?.range;
    const after = items[at + 1]?.range;
    if (before) return { from: before[1], to: item.range[1], insert: '' };
    if (after) return { from: item.range[0], to: after[0], insert: '' };
    return { from: item.range[0], to: item.range[1], insert: '' };
  }
  if (isLineString(value)) {
    const words = wordsOf(yaml, value);
    const at = words.findIndex((word) => isTag(key)(word.text));
    const word = words[at];
    if (!word) return null;
    const before = words[at - 1];
    const after = words[at + 1];
    if (before) return { from: before.to, to: word.to, insert: '' };
    if (after) return { from: word.from, to: after.from, insert: '' };
    // The only one: an empty list stands in its place.
    const [start, end] = value.range ?? [0, 0];
    return { from: start, to: end, insert: '[]' };
  }
  return null;
}

/** The front matter as data with its tags left out, to compare; undefined when it isn't a map. */
function besideTags(yaml: string): string | undefined {
  try {
    const data: unknown = parse(yaml, { uniqueKeys: false }) ?? {};
    if (typeof data !== 'object' || Array.isArray(data)) return undefined;
    const { tags: _, ...rest } = data as Record<string, unknown>;
    return JSON.stringify(rest);
  } catch {
    return undefined;
  }
}

/** Each tag's key, as many times as it's written. */
const keysIn = (yaml: string) => frontMatterTags(yaml).map(tagKey).sort();

/**
 * `text` with its front matter's YAML spliced, when, read back, the rest of
 * the front matter is as it was and its tags are `want` (keys, each as many
 * times as written); else null: a splice must never change what it wasn't for.
 */
function spliced(text: string, splice: Splice, want: readonly string[]): string | null {
  const front = frontMatterBlock(text);
  if (!front) return null;
  const { yaml } = front;
  const next = yaml.slice(0, splice.from) + splice.insert + yaml.slice(splice.to);
  const kept = besideTags(yaml);
  if (kept === undefined || besideTags(next) !== kept) return null;
  if (keysIn(next).join('\n') !== [...want].sort().join('\n')) return null;
  // The closing line, and what follows it, as they were.
  const closing = text.slice(4 + yaml.length, front.end);
  return `---\n${next}${yaml === '' ? '\n' : ''}${closing}${text.slice(front.end)}`;
}

/**
 * `text` with `tag` in its front matter's `tags:` (made, with the front
 * matter itself, when there's none); `text` itself when it's there already,
 * case aside. Null when `tag` isn't a tag, or it can't be added without
 * rewriting what the writer wrote: broken YAML, front matter that isn't a
 * map of keys, tags in some other shape.
 */
export function withTagAdded(text: string, tag: string): string | null {
  const tidy = tidyTag(tag);
  if (!tidy) return null;
  const front = frontMatterBlock(text);
  if (!front) return `---\ntags: [${tidy}]\n---\n${text}`;
  const had = keysIn(front.yaml);
  if (had.includes(tagKey(tidy))) return text;
  const splice = adding(front.yaml, tidy);
  return splice && spliced(text, splice, [...had, tagKey(tidy)]);
}

/**
 * `text` without `tag` in its front matter, however many times and in
 * whatever case it's written there; `text` itself when it isn't there. The
 * words after the front matter are left as they are: a #tag typed in them
 * stays. Null when it can't be taken out without rewriting what the writer
 * wrote.
 */
export function withTagRemoved(text: string, tag: string): string | null {
  const tidy = tidyTag(tag);
  if (!tidy) return null;
  const key = tagKey(tidy);
  let now = text;
  for (;;) {
    const front = frontMatterBlock(now);
    const had = front ? keysIn(front.yaml) : [];
    if (!front || !had.includes(key)) return now;
    // One writing at a time (#Draft, then #draft), each checked as it goes.
    const splice = removing(front.yaml, key);
    const want = [...had];
    want.splice(want.indexOf(key), 1);
    const next = splice && spliced(now, splice, want);
    if (!next) return null;
    now = next;
  }
}
