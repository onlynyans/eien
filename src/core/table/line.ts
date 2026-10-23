// One line of a GFM table as it's written, read and written back without
// losing a character: a line read and written again is the same line. The
// table editor (spec §4, Tables) changes cells, never the way a line is
// written round them.

/** A table's line, split on its pipes: what's round the cells, and each cell as written. */
export interface TableLine {
  /** What comes before the row: a quote's ">" and the spaces before the first cell or pipe. */
  readonly lead: string;
  /** Whether it opens with a pipe ("| a | b"). */
  readonly open: boolean;
  /** Each cell as written: its spaces and escapes too. */
  readonly cells: readonly string[];
  /** Whether it ends with a pipe ("a | b |"). */
  readonly close: boolean;
  /** The spaces after the closing pipe. */
  readonly tail: string;
}

/** Where `text` has a pipe that splits cells, as GFM splits them: "|", but not "\|". */
export function pipesIn(text: string, from = 0): number[] {
  const bars: number[] = [];
  let escaped = false;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '|' && !escaped) bars.push(i);
    escaped = !escaped && text[i] === '\\';
  }
  return bars;
}

const blank = (text: string) => text.trim() === '';

/** The length of what comes before a row: in a quote, its ">" marks; and the spaces. */
export function leadOf(text: string, quoted: boolean): number {
  return (quoted ? /^[>\s]*/u : /^\s*/u).exec(text)?.[0].length ?? 0;
}

/** `text`, a line of a table; `quoted` when the table is in a quote, whose ">" marks aren't cells. */
export function readLine(text: string, quoted = false): TableLine {
  const leadEnd = leadOf(text, quoted);
  const lead = text.slice(0, leadEnd);
  const bars = pipesIn(text, leadEnd);
  const first = bars[0];
  const last = bars.at(-1);
  if (first === undefined || last === undefined) {
    return { lead, open: false, cells: [text.slice(leadEnd)], close: false, tail: '' };
  }
  const open = first === leadEnd;
  // One pipe can't both open and close a row: "|" alone opens it.
  const close = blank(text.slice(last + 1)) && (bars.length > 1 || !open);
  const edges = [open ? first : leadEnd - 1, ...bars.slice(open ? 1 : 0, close ? -1 : undefined)];
  const end = close ? last : text.length;
  const cells = edges.map((edge, i) => text.slice(edge + 1, edges[i + 1] ?? end));
  return { lead, open, cells, close, tail: close ? text.slice(last + 1) : '' };
}

/** The line as it's written. */
export function writeLine(line: TableLine): string {
  return `${line.lead}${line.open ? '|' : ''}${line.cells.join('|')}${line.close ? '|' : ''}${line.tail}`;
}

/** Where cell `c` starts in the line as written. */
export function cellStart(line: TableLine, c: number): number {
  let at = line.lead.length + (line.open ? 1 : 0);
  for (let i = 0; i < c && i < line.cells.length; i++) at += (line.cells[i]?.length ?? 0) + 1;
  return at;
}

/** The cell a place `at` in the written line is in: a pipe's left belongs to the cell before it. */
export function cellOf(line: TableLine, at: number): number {
  let end = line.lead.length + (line.open ? 1 : 0);
  for (const [c, cell] of line.cells.entries()) {
    end += cell.length;
    if (at <= end) return c;
    end += 1;
  }
  return Math.max(0, line.cells.length - 1);
}
