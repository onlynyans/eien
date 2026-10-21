// Line formats: headings, quotes, lists and checklists. Each applies to
// every line the selection touches, and toggles: on lines that already have
// it, it comes off.

import type { Change, Edit, Selection } from './edit';

export type LineFormat =
  | { readonly kind: 'heading'; readonly level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { readonly kind: 'quote' }
  | { readonly kind: 'bullet' }
  | { readonly kind: 'numbered' }
  | { readonly kind: 'checklist' };

const HEADING = /^#{1,6}[ \t]+/;
const QUOTE = /^>[ \t]?/;
/** A list marker with its checkbox, if any: "- ", "* ", "+ ", "1. ", "2) ", "- [ ] ", "- [x] ". */
const LIST = /^(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/;
const CHECK = /^[-*+][ \t]+\[[ xX]\][ \t]+/;
const BULLET = /^[-*+][ \t]+(?!\[[ xX]\])/;
const NUMBERED = /^\d{1,9}[.)][ \t]+/;

/** Leading spaces kept as they are: an indented list item stays indented. */
const INDENT = /^[ \t]*/;

interface Line {
  readonly from: number;
  readonly text: string;
}

function linesTouching(text: string, selection: Selection): Line[] {
  const start = text.lastIndexOf('\n', selection.from - 1) + 1;
  const lines: Line[] = [];
  let from = start;
  for (;;) {
    const newline = text.indexOf('\n', from);
    const end = newline === -1 ? text.length : newline;
    lines.push({ from, text: text.slice(from, end) });
    // A selection ending at the very start of a line doesn't take that line.
    if (
      newline === -1 ||
      newline + 1 > selection.to ||
      (newline + 1 === selection.to && selection.from !== selection.to)
    )
      break;
    from = newline + 1;
  }
  return lines;
}

/** Whether `line` (after its indent) already has `format`. */
function has(body: string, format: LineFormat): boolean {
  switch (format.kind) {
    case 'heading':
      return (
        new RegExp(`^#{${format.level}}[ \\t]+`).test(body) &&
        !body.startsWith('#'.repeat(format.level + 1))
      );
    case 'quote':
      return QUOTE.test(body);
    case 'bullet':
      return BULLET.test(body);
    case 'numbered':
      return NUMBERED.test(body);
    case 'checklist':
      return CHECK.test(body);
  }
}

/** The prefix `format` gives the n-th line (from 0). */
function prefixFor(format: LineFormat, n: number): string {
  switch (format.kind) {
    case 'heading':
      return `${'#'.repeat(format.level)} `;
    case 'quote':
      return '> ';
    case 'bullet':
      return '- ';
    case 'numbered':
      return `${n + 1}. `;
    case 'checklist':
      return '- [ ] ';
  }
}

/** The existing prefix `format` replaces (its own family: headings replace headings, lists replace lists). */
function existing(body: string, format: LineFormat): string {
  const pattern = format.kind === 'heading' ? HEADING : format.kind === 'quote' ? QUOTE : LIST;
  return pattern.exec(body)?.[0] ?? '';
}

export function toggleLines(text: string, selection: Selection, format: LineFormat): Edit {
  const lines = linesTouching(text, selection);
  const content = lines.filter((line) => line.text.trim() !== '' || lines.length === 1);
  const allHave = content.every((line) => has(line.text.replace(INDENT, ''), format));
  const changes: Change[] = [];
  let n = 0;
  for (const line of content) {
    const indent = INDENT.exec(line.text)?.[0] ?? '';
    const body = line.text.slice(indent.length);
    const old = existing(body, format);
    const from = line.from + indent.length;
    const insert = allHave ? '' : prefixFor(format, n++);
    if (old !== insert) changes.push({ from, to: from + old.length, insert });
  }
  // Where a position lands: a caret, or a selection's end, moves past a new
  // prefix (typing carries on in the words); a selection that started at
  // the line's start grows to take the new prefix in.
  const at = (pos: number, keepBefore: boolean) => {
    let shift = 0;
    for (const change of changes) {
      if (change.from < pos && pos < change.to) return change.from + shift + change.insert.length;
      if (change.to < pos || (change.to === pos && !(keepBefore && change.from === pos))) {
        shift += change.insert.length - (change.to - change.from);
      }
    }
    return pos + shift;
  };
  const range = selection.from !== selection.to;
  return { changes, selection: { from: at(selection.from, range), to: at(selection.to, false) } };
}

/** The heading level a line is written at ("## Title" is 2), as toggleLines reads it; 0 for none. */
export const headingLevel = (line: string): number =>
  /^[ \t]*(#{1,6})[ \t]+/.exec(line)?.[1]?.length ?? 0;

/** Tick or untick the checklist item on the line holding `pos`; null if it isn't one. */
export function toggleCheck(text: string, pos: number): Edit | null {
  const lineFrom = text.lastIndexOf('\n', pos - 1) + 1;
  const lineEnd = text.indexOf('\n', lineFrom);
  const line = text.slice(lineFrom, lineEnd === -1 ? text.length : lineEnd);
  const match = /^([ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+\[)([ xX])\]/.exec(line);
  if (!match) return null;
  const at = lineFrom + (match[1]?.length ?? 0);
  return {
    changes: [{ from: at, to: at + 1, insert: match[2] === ' ' ? 'x' : ' ' }],
    selection: { from: pos, to: pos },
  };
}
