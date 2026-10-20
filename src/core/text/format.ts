// A note's bytes kept as found (spec §2): the editor works in "\n" text with
// no byte-order mark; writing back restores the file's own mark and line
// endings.

const BOM = '﻿';

export interface TextFormat {
  /** The file began with a UTF-8 byte-order mark. */
  readonly bom: boolean;
  /** Its line ending: the one most of its lines use. */
  readonly eol: '\n' | '\r\n';
}

/** What a new note is written as. */
export const PLAIN_FORMAT: TextFormat = { bom: false, eol: '\n' };

export function formatOf(raw: string): TextFormat {
  const crlf = raw.match(/\r\n/g)?.length ?? 0;
  const lf = (raw.match(/\n/g)?.length ?? 0) - crlf;
  return { bom: raw.startsWith(BOM), eol: crlf > lf ? '\r\n' : '\n' };
}

/** The text the editor shows: no mark, every line ending "\n" (old Mac "\r" too). */
export const toEditor = (raw: string): string =>
  (raw.startsWith(BOM) ? raw.slice(1) : raw).replace(/\r\n?/g, '\n');

/** The file's bytes for `text`, in `format`. */
export const fromEditor = (text: string, format: TextFormat): string =>
  (format.bom ? BOM : '') + (format.eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
