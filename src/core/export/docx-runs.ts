// Word's runs and paragraphs (WordprocessingML) from pieces of text, for
// ./docx-body.ts: run properties in the order Word's schema wants them,
// spaces as a page shows them, hyperlinks round the runs that are theirs.

import { escapeXml } from './xml';

/** How a run looks: the run properties it carries, in the order Word's schema wants them. */
export interface Look {
  readonly b?: true;
  readonly i?: true;
  readonly strike?: true;
  readonly mark?: true;
  readonly u?: true;
  readonly sup?: true;
  readonly sub?: true;
  readonly code?: true;
}

/** HTML's inline tags as the run properties they give. */
export const LOOKS: Readonly<Record<string, keyof Look>> = {
  em: 'i',
  i: 'i',
  cite: 'i',
  strong: 'b',
  b: 'b',
  u: 'u',
  ins: 'u',
  s: 'strike',
  del: 'strike',
  strike: 'strike',
  mark: 'mark',
  sup: 'sup',
  sub: 'sub',
  code: 'code',
};

export type Piece =
  | { readonly kind: 'text'; text: string; readonly look: Look; readonly link: number | null }
  | { readonly kind: 'break'; readonly link: number | null }
  | { readonly kind: 'note'; readonly n: number }
  | { readonly kind: 'image'; readonly drawing: Drawing; readonly link: number | null };

/** An image drawn in the text: its relationship, its size in EMU, its own id and words. */
export interface Drawing {
  readonly rel: string;
  readonly cx: number;
  readonly cy: number;
  readonly id: number;
  readonly name: string;
  readonly alt: string;
}

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';

/** A picture in line with the words (the "wp" prefix is declared on the part's root). */
function drawingXml(d: Drawing): string {
  const alt = escapeXml(d.alt);
  const extent = `cx="${d.cx}" cy="${d.cy}"`;
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent ${extent}/><wp:docPr id="${d.id}" name="Picture ${d.id}" descr="${alt}"/><a:graphic xmlns:a="${A}"><a:graphicData uri="${PIC}"><pic:pic xmlns:pic="${PIC}"><pic:nvPicPr><pic:cNvPr id="${d.id}" name="${escapeXml(d.name)}" descr="${alt}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${d.rel}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext ${extent}/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

export const COURIER = '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>';

function runProperties(look: Look, style: string | null): string {
  const parts = [
    style ? `<w:rStyle w:val="${style}"/>` : '',
    look.code ? COURIER : '',
    look.b ? '<w:b/>' : '',
    look.i ? '<w:i/>' : '',
    look.strike ? '<w:strike/>' : '',
    look.mark ? '<w:highlight w:val="yellow"/>' : '',
    look.u ? '<w:u w:val="single"/>' : '',
    look.sup
      ? '<w:vertAlign w:val="superscript"/>'
      : look.sub
        ? '<w:vertAlign w:val="subscript"/>'
        : '',
  ].join('');
  return parts ? `<w:rPr>${parts}</w:rPr>` : '';
}

/** Text as a run's content: tabs as Word's tabs, line ends as breaks (in code); as a whole run with `run`. */
export function runText(text: string, run = false): string {
  const content = text
    .split(/(\t|\n)/u)
    .filter((part) => part !== '')
    .map((part) =>
      part === '\t'
        ? '<w:tab/>'
        : part === '\n'
          ? '<w:br/>'
          : `<w:t xml:space="preserve">${escapeXml(part)}</w:t>`,
    )
    .join('');
  return run && content ? `<w:r>${content}</w:r>` : content;
}

export interface ParagraphLook {
  readonly style: string;
  /** A list item's numbering: its list and level. */
  readonly list?: { readonly id: number; readonly level: number };
  /** Further indent, in twentieths of a point (a quote in a quote, a list's later paragraph). */
  readonly indent?: number;
  /** Word's page break before a heading, turned off (the first chapter, with no title page). */
  readonly noPageBreak?: boolean;
}

/** A paragraph of `pieces`; in code (`keep`) its spaces and line ends are as written. */
export function paragraph(pieces: readonly Piece[], look: ParagraphLook, keep = false): string {
  let runs = '';
  let open: number | null = null;
  for (const piece of pieces) {
    const link = piece.kind === 'note' ? null : piece.link;
    if (link !== open) {
      if (open !== null) runs += '</w:hyperlink>';
      if (link !== null) runs += `<w:hyperlink r:id="rIdLink${link}" w:history="1">`;
      open = link;
    }
    if (piece.kind === 'image') {
      runs += drawingXml(piece.drawing);
    } else if (piece.kind === 'note') {
      runs += `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${piece.n}"/></w:r>`;
    } else if (piece.kind === 'break') {
      runs += '<w:r><w:br/></w:r>';
    } else {
      const content = keep ? runText(piece.text) : runText(piece.text.replace(/\n/gu, ' '));
      if (content)
        runs += `<w:r>${runProperties(piece.look, link === null ? null : 'Hyperlink')}${content}</w:r>`;
    }
  }
  if (open !== null) runs += '</w:hyperlink>';
  return `<w:p>${paragraphProperties(look)}${runs}</w:p>`;
}

export function paragraphProperties(look: ParagraphLook): string {
  const list = look.list
    ? `<w:numPr><w:ilvl w:val="${Math.min(look.list.level, 8)}"/><w:numId w:val="${look.list.id}"/></w:numPr>`
    : '';
  const pageBreak = look.noPageBreak ? '<w:pageBreakBefore w:val="0"/>' : '';
  const indent = look.indent ? `<w:ind w:left="${look.indent}"/>` : '';
  return `<w:pPr><w:pStyle w:val="${look.style}"/>${pageBreak}${list}${indent}</w:pPr>`;
}

/** A paragraph given another look: its properties replaced. */
export const restyle = (paragraph: string, look: ParagraphLook): string =>
  paragraph.replace(/^<w:p><w:pPr>.*?<\/w:pPr>/u, `<w:p>${paragraphProperties(look)}`);

/** Spaces as a page shows them: runs of space as one, none at a line's start or end. */
export function collapse(pieces: Piece[]): Piece[] {
  let atLineStart = true;
  for (const piece of pieces) {
    if (piece.kind !== 'text') {
      if (piece.kind === 'break') trimEnd(pieces, pieces.indexOf(piece));
      atLineStart = piece.kind === 'break';
      continue;
    }
    piece.text = piece.text.replace(/[ \t\n\r]+/gu, ' ');
    if (atLineStart) piece.text = piece.text.replace(/^ /u, '');
    if (piece.text) atLineStart = piece.text.endsWith(' ');
  }
  trimEnd(pieces, pieces.length);
  return pieces.filter((piece) => piece.kind !== 'text' || piece.text !== '');
}

/** The spaces just before `at` (a break, or the paragraph's end) taken off. */
function trimEnd(pieces: Piece[], at: number): void {
  for (let i = at - 1; i >= 0; i--) {
    const piece = pieces[i] as Piece;
    if (piece.kind !== 'text') return;
    piece.text = piece.text.replace(/ +$/u, '');
    if (piece.text) return;
  }
}
