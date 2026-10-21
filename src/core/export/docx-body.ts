// A chapter's HTML (./chapter.ts) as Word's paragraphs: headings, quotes,
// lists, code and tables in Word's own styles (./docx.ts defines them),
// emphasis as run properties, links as hyperlinks, and footnote marks as
// Word's own footnotes. Read with core/ao3's HTML reader, so what Word gets
// is what the EPUB and the PDF show.

import { type HtmlElement, type HtmlNode, parseHtml } from '../ao3';
import type { Chapter } from './chapter';
import { escapeXml } from './xml';

/** How a run looks: the run properties it carries, in the order Word's schema wants them. */
interface Look {
  readonly b?: true;
  readonly i?: true;
  readonly strike?: true;
  readonly mark?: true;
  readonly u?: true;
  readonly sup?: true;
  readonly sub?: true;
  readonly code?: true;
}

type Piece =
  | { readonly kind: 'text'; text: string; readonly look: Look; readonly link: number | null }
  | { readonly kind: 'break'; readonly link: number | null }
  | { readonly kind: 'note'; readonly n: number };

const LOOKS: Readonly<Record<string, keyof Look>> = {
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

const BLOCKS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'ul',
  'ol',
  'li',
  'pre',
  'table',
  'hr',
  'div',
  'section',
  'aside',
]);

const COURIER = '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>';

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
function runText(text: string, run = false): string {
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

const text = (node: HtmlNode): string =>
  node.kind === 'text' ? node.text : node.children.map(text).join('');

export interface ParagraphLook {
  readonly style: string;
  /** A list item's numbering: its list and level. */
  readonly list?: { readonly id: number; readonly level: number };
  /** Further indent, in twentieths of a point (a quote in a quote, a list's later paragraph). */
  readonly indent?: number;
  /** Word's page break before a heading, turned off (the first chapter, with no title page). */
  readonly noPageBreak?: boolean;
}

/** Writes chapters as Word's body, gathering what other parts need: links, lists, footnotes. */
export class DocxWriter {
  /** Hyperlink addresses; the n-th is the relationship "rIdLink<n>". */
  readonly links: string[] = [];
  /** Each numbered list's id, after the bullets' 1. */
  readonly numberedLists: number[] = [];
  /** Word's footnotes, from id 1. */
  readonly footnotes: string[] = [];
  /** In a footnote, a mark can't be a footnote: it's its number. */
  #inNote = false;
  /** The chapter written now's notes. */
  #notes: Chapter['notes'] = [];
  /** The chapter's notes made footnotes, by number. */
  #placed = new Set<number>();

  /** The chapter's paragraphs; its notes become footnotes, those never referred to its last paragraphs. */
  chapter(chapter: Chapter, first: boolean): string[] {
    this.#notes = chapter.notes;
    this.#placed = new Set();
    const heading = this.#paragraph(this.#inline(parseHtml(chapter.heading)), {
      style: 'Heading1',
      noPageBreak: first,
    });
    const body = this.#blocks(chapter.blocks.join('\n'), 0, 0, null);
    // A note no mark in the text made a footnote (a mark in a footnote is only its number): at the end.
    const unreferred = chapter.notes.flatMap((note, i) =>
      this.#placed.has(i + 1) ? [] : this.#noteParagraphs(note.blocks, runText(`${i + 1}. `, true)),
    );
    return [heading, ...body, ...unreferred];
  }

  /** A note's paragraphs, `lead` (runs: its number) at the start of the first. */
  #noteParagraphs(blocks: readonly string[], lead: string): string[] {
    this.#inNote = true;
    const paragraphs = this.#blocks(blocks.join('\n'), 0, 0, 'FootnoteText');
    this.#inNote = false;
    const [first, ...rest] = paragraphs;
    if (!first?.startsWith('<w:p>')) {
      return [`<w:p>${paragraphProperties({ style: 'FootnoteText' })}${lead}</w:p>`, ...paragraphs];
    }
    return [first.replace(/^(<w:p><w:pPr>.*?<\/w:pPr>)/u, (pPr) => pPr + lead), ...rest];
  }

  /**
   * A Word footnote holding note `n`'s words; null for none. Each mark is a
   * footnote of its own: Word gives one footnote one mark.
   */
  #footnote(n: number): number | null {
    const note = this.#notes[n - 1];
    if (!note) return null;
    const ref = `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>${runText(' ', true)}`;
    const id = this.footnotes.length + 1;
    this.#placed.add(n);
    this.footnotes.push(
      `<w:footnote w:id="${id}">${this.#noteParagraphs(note.blocks, ref).join('')}</w:footnote>`,
    );
    return id;
  }

  /** Block HTML as paragraphs and tables; `quote` and `level` say how deep in quotes and lists it is. */
  #blocks(html: string | HtmlNode[], quote: number, level: number, style: string | null): string[] {
    const nodes = typeof html === 'string' ? parseHtml(html) : html;
    const out: string[] = [];
    let loose: HtmlNode[] = []; // inline content between blocks: a paragraph of its own
    let after = true; // a paragraph after a heading or a scene break isn't indented
    const flush = () => {
      const pieces = this.#inline(loose);
      loose = [];
      if (pieces.length) out.push(this.#paragraph(pieces, this.#bodyLook(style, quote, after)));
    };
    for (const node of nodes) {
      if (node.kind === 'text' || !BLOCKS.has(node.name)) {
        loose.push(node);
        continue;
      }
      flush();
      const name = node.name;
      const scene = name === 'hr' || (name === 'p' && node.attrs.class === 'scene-break');
      if (scene) {
        out.push(
          this.#paragraph([{ kind: 'text', text: '* * *', look: {}, link: null }], {
            style: 'SceneBreak',
          }),
        );
      } else if (/^h[1-6]$/u.test(name)) {
        const n = Number(name[1]);
        out.push(this.#paragraph(this.#inline(node.children), { style: style ?? `Heading${n}` }));
      } else if (name === 'p' || name === 'li') {
        out.push(this.#paragraph(this.#inline(node.children), this.#bodyLook(style, quote, after)));
      } else if (name === 'blockquote') {
        out.push(...this.#blocks(node.children, quote + 1, level, style));
      } else if (name === 'ul' || name === 'ol') {
        out.push(...this.#list(node, quote, level, style));
      } else if (name === 'pre') {
        // HTML ignores a line end just after <pre> (the writer adds one before code that starts blank).
        const code = text(node).replace(/^\n/u, '');
        const pieces: Piece[] = [{ kind: 'text', text: code, look: {}, link: null }];
        out.push(this.#paragraph(pieces, { style: style ?? 'SourceCode' }, true));
      } else if (name === 'table') {
        out.push(this.#table(node));
      } else {
        out.push(...this.#blocks(node.children, quote, level, style)); // div, section: what's in it
      }
      after = scene || /^h[1-6]$/u.test(name);
    }
    flush();
    return out;
  }

  #bodyLook(style: string | null, quote: number, after: boolean): ParagraphLook {
    if (style) return { style };
    if (quote > 0) return { style: 'Quote', ...(quote > 1 ? { indent: 720 * quote } : {}) };
    return { style: after ? 'FirstParagraph' : 'Normal' };
  }

  #list(list: HtmlElement, quote: number, level: number, style: string | null): string[] {
    let id = 1; // the bullets'
    if (list.name === 'ol') {
      id = this.numberedLists.length + 2;
      this.numberedLists.push(level);
    }
    const out: string[] = [];
    for (const item of list.children) {
      if (item.kind !== 'element' || item.name !== 'li') continue;
      const inline: HtmlNode[] = [];
      const nested: HtmlNode[] = [];
      for (const child of item.children) {
        if (nested.length || (child.kind === 'element' && BLOCKS.has(child.name)))
          nested.push(child);
        else inline.push(child);
      }
      let numbered = false;
      const pieces = this.#inline(inline);
      if (pieces.length || !nested.length) {
        out.push(this.#paragraph(pieces, { style: style ?? 'ListParagraph', list: { id, level } }));
        numbered = true;
      }
      for (const child of nested) {
        if (child.kind === 'element' && (child.name === 'ul' || child.name === 'ol')) {
          out.push(...this.#list(child, quote, level + 1, style));
          continue;
        }
        const paragraphs = this.#blocks([child], quote, level, style ?? 'ListParagraph');
        for (const paragraph of paragraphs) {
          const look: ParagraphLook = numbered
            ? { style: style ?? 'ListParagraph', indent: 720 * (level + 1) }
            : { style: style ?? 'ListParagraph', list: { id, level } };
          out.push(paragraph.startsWith('<w:p>') ? restyle(paragraph, look) : paragraph);
          numbered = true;
        }
      }
    }
    return out;
  }

  #table(table: HtmlElement): string {
    const rows: HtmlElement[] = [];
    const walk = (node: HtmlElement) => {
      for (const child of node.children) {
        if (child.kind !== 'element') continue;
        if (child.name === 'tr') rows.push(child);
        else if (['thead', 'tbody', 'tfoot'].includes(child.name)) walk(child);
      }
    };
    walk(table);
    const cellsOf = (row: HtmlElement) =>
      row.children.filter(
        (c): c is HtmlElement => c.kind === 'element' && (c.name === 'td' || c.name === 'th'),
      );
    const columns = Math.max(1, ...rows.map((row) => cellsOf(row).length));
    const width = Math.floor(9000 / columns);
    const line = '<w:LINE w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
    const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((side) => line.replace('LINE', side))
      .join('');
    const xmlRows = rows.map((row) => {
      const cells = cellsOf(row);
      const xmlCells = Array.from({ length: columns }, (_, i) => {
        const cell = cells[i];
        const look: Look = cell?.name === 'th' ? { b: true } : {};
        const pieces = cell ? this.#inline(cell.children, look) : [];
        return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${this.#paragraph(pieces, { style: 'TableText' })}</w:tc>`;
      });
      return `<w:tr>${xmlCells.join('')}</w:tr>`;
    });
    const grid = Array.from({ length: columns }, () => `<w:gridCol w:w="${width}"/>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borders}</w:tblBorders><w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${xmlRows.join('')}</w:tbl>`;
  }

  /** Inline HTML as pieces of text, breaks and notes, its spaces as a page shows them. */
  #inline(nodes: readonly HtmlNode[], look: Look = {}, link: number | null = null): Piece[] {
    const pieces: Piece[] = [];
    const walk = (node: HtmlNode, look: Look, link: number | null) => {
      if (node.kind === 'text') {
        pieces.push({ kind: 'text', text: node.text, look, link });
        return;
      }
      const name = node.name;
      if (name === 'br') pieces.push({ kind: 'break', link });
      else if (name === 'a' && node.attrs.class === 'noteref') {
        const n = Number(text(node));
        const id = this.#inNote ? null : this.#footnote(n);
        if (id !== null) pieces.push({ kind: 'note', n: id });
        else pieces.push({ kind: 'text', text: String(n), look: { ...look, sup: true }, link });
      } else if (name === 'a' && node.attrs.href) {
        this.links.push(node.attrs.href);
        for (const child of node.children) walk(child, look, this.links.length);
      } else {
        const add = LOOKS[name];
        const inner = add ? { ...look, [add]: true } : look;
        for (const child of node.children) walk(child, inner, link);
      }
    };
    for (const node of nodes) walk(node, look, link);
    return collapse(pieces);
  }

  /** A paragraph of `pieces`; in code (`keep`) its spaces and line ends are as written. */
  #paragraph(pieces: readonly Piece[], look: ParagraphLook, keep = false): string {
    let runs = '';
    let open: number | null = null;
    for (const piece of pieces) {
      const link = piece.kind === 'note' ? null : piece.link;
      if (link !== open) {
        if (open !== null) runs += '</w:hyperlink>';
        if (link !== null) runs += `<w:hyperlink r:id="rIdLink${link}" w:history="1">`;
        open = link;
      }
      if (piece.kind === 'note') {
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
}

function paragraphProperties(look: ParagraphLook): string {
  const list = look.list
    ? `<w:numPr><w:ilvl w:val="${Math.min(look.list.level, 8)}"/><w:numId w:val="${look.list.id}"/></w:numPr>`
    : '';
  const pageBreak = look.noPageBreak ? '<w:pageBreakBefore w:val="0"/>' : '';
  const indent = look.indent ? `<w:ind w:left="${look.indent}"/>` : '';
  return `<w:pPr><w:pStyle w:val="${look.style}"/>${pageBreak}${list}${indent}</w:pPr>`;
}

/** A paragraph given another look: its properties replaced. */
const restyle = (paragraph: string, look: ParagraphLook): string =>
  paragraph.replace(/^<w:p><w:pPr>.*?<\/w:pPr>/u, `<w:p>${paragraphProperties(look)}`);

/** Spaces as a page shows them: runs of space as one, none at a line's start or end. */
function collapse(pieces: Piece[]): Piece[] {
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
