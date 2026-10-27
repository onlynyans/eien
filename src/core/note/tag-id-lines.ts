// The front matter's `tags:` and `id:` lines (backlog #45), which the editor
// can keep out of sight so they aren't edited by accident: the tags are
// edited on the page instead, and the id is the seals' (spec §9). Found as
// YAML reads them, so a list's items and a comment after a value go with
// their key; front matter YAML can't read is left alone, in sight.

import { isMap, isScalar, type Node, parseDocument } from 'yaml';
import { frontMatterBlock } from '../text';

/** Whole lines of a note's text: from the first's start to the last's end, its newline not taken. */
export interface LineSpan {
  readonly from: number;
  readonly to: number;
}

export interface TagAndIdLines {
  /** Out of sight: each key's lines, or the whole front matter when they're all it holds. */
  readonly hidden: readonly LineSpan[];
  /** Kept as they are: the hidden lines, and the "---" lines that make them front matter. */
  readonly kept: readonly LineSpan[];
}

export const NO_LINES: TagAndIdLines = { hidden: [], kept: [] };

const KEYS = new Set(['tags', 'id']);

/** The `tags:` and `id:` lines of `text`'s front matter (editor text, "\n" lines). */
export function tagAndIdLines(text: string): TagAndIdLines {
  const block = frontMatterBlock(text.slice(0, 65_536));
  if (!block) return NO_LINES;
  const { yaml } = block;
  const doc = parseDocument(yaml, { uniqueKeys: false });
  if (doc.errors.length > 0 || !isMap(doc.contents)) return NO_LINES;

  const spans: LineSpan[] = [];
  for (const pair of doc.contents.items) {
    if (!isScalar(pair.key) || !KEYS.has(String(pair.key.value))) continue;
    const [start, keyEnd] = pair.key.range ?? [0, 0];
    // A key in a line of its own: not one of a flow map's ({tags: [a], id: x}).
    if (start > 0 && yaml[start - 1] !== '\n') continue;
    let end = Math.max(keyEnd, (pair.value as Node | null)?.range?.[1] ?? 0);
    while (end > start && /\s/.test(yaml.charAt(end - 1))) end--;
    const newline = yaml.indexOf('\n', end);
    spans.push({ from: start, to: newline === -1 ? yaml.length : newline });
  }
  if (spans.length === 0) return NO_LINES;

  // The YAML starts after the opening "---\n".
  const lines = merged(spans.map((span) => ({ from: span.from + 4, to: span.to + 4 })));
  const close = block.end - (text[block.end - 1] === '\n' ? 1 : 0);
  const closing = { from: text.lastIndexOf('\n', close - 1) + 1, to: close };
  const shown = [
    { from: 3, to: lines[0]?.from ?? 0 },
    ...lines.map((span, i) => ({
      from: span.to,
      to: (lines[i + 1] ?? closing).from,
    })),
  ];
  // Nothing else in it but blank lines: the front matter goes out of sight whole.
  if (shown.every((gap) => text.slice(gap.from, gap.to).trim() === '')) {
    const whole = [{ from: 0, to: close }];
    return { hidden: whole, kept: whole };
  }
  return { hidden: lines, kept: merged([{ from: 0, to: 3 }, ...lines, closing]) };
}

/** `spans` in order, those on neighbouring lines made one. */
function merged(spans: readonly LineSpan[]): LineSpan[] {
  const out: LineSpan[] = [];
  for (const span of [...spans].sort((a, b) => a.from - b.from)) {
    const last = out.at(-1);
    if (last && span.from <= last.to + 1)
      out[out.length - 1] = { from: last.from, to: Math.max(last.to, span.to) };
    else out.push(span);
  }
  return out;
}
