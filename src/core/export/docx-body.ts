// A chapter's HTML (./chapter.ts) as Word's paragraphs: headings, quotes,
// lists, code and tables in Word's own styles (./docx.ts defines them),
// emphasis as run properties, links as hyperlinks, and footnote marks as
// Word's own footnotes. Read with core/ao3's HTML reader, so what Word gets
// is what the EPUB and the PDF show.

import { type HtmlElement, type HtmlNode, parseHtml } from '../ao3';
import { IMAGE_SRC } from './book';
import type { Chapter, ExportImage } from './chapter';
import {
  collapse,
  type Drawing,
  LOOKS,
  type Look,
  type ParagraphLook,
  type Piece,
  paragraph,
  paragraphProperties,
  restyle,
  runText,
} from './docx-runs';
import { IMAGE_KINDS } from './images';

/** A pixel at 96 to the inch, in English Metric Units (914,400 to the inch). */
const EMU_PER_PIXEL = 9525;
/** A twip (a twentieth of a point, Word's measure of the page), in EMU. */
const TWIP = 635;

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

const text = (node: HtmlNode): string =>
  node.kind === 'text' ? node.text : node.children.map(text).join('');

/** Writes chapters as Word's body, gathering what other parts need: links, lists, footnotes. */
export class DocxWriter {
  /** The book's images, as chaptersOf numbers them: the n-th is the relationship "rIdImage<n+1>". */
  readonly #images: readonly ExportImage[];
  /** The text's width and height, in EMU: no picture is drawn larger. */
  readonly #area: { readonly cx: number; readonly cy: number };
  /** The width a picture has where it's drawn now (a quote's, a list's, a cell's), in EMU. */
  #room = Number.POSITIVE_INFINITY;
  /** The pictures drawn so far: each one's id in the document. */
  #drawn = 0;

  constructor(images: readonly ExportImage[], area: { cx: number; cy: number }) {
    this.#images = images;
    this.#area = area;
  }

  /** A picture for `src` (a book's "eien-image:<n>"), at 96 pixels an inch, made to fit. */
  #drawing(src: string, alt: string): Drawing | null {
    const n = IMAGE_SRC.exec(src)?.[1];
    const image = n === undefined ? undefined : this.#images[Number(n)];
    if (!image) return null;
    const { width, height, kind } = image.info;
    const room = Math.min(this.#area.cx, this.#room);
    const scale = Math.min(
      1,
      room / (width * EMU_PER_PIXEL),
      this.#area.cy / (height * EMU_PER_PIXEL),
    );
    this.#drawn += 1;
    return {
      rel: `rIdImage${Number(n) + 1}`,
      cx: Math.max(1, Math.round(width * EMU_PER_PIXEL * scale)),
      cy: Math.max(1, Math.round(height * EMU_PER_PIXEL * scale)),
      id: this.#drawn,
      name: `image-${Number(n) + 1}.${IMAGE_KINDS[kind].extension}`,
      alt,
    };
  }

  /** Hyperlink addresses; the n-th is the relationship "rIdLink<n>". */
  readonly links: string[] = [];
  /** Each numbered list, its id after the bullets' 1: the level it's at, and its first number. */
  readonly numberedLists: { readonly level: number; readonly start: number }[] = [];
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
    const heading = paragraph(this.#inline(parseHtml(chapter.heading)), {
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
      if (pieces.length) out.push(paragraph(pieces, this.#bodyLook(style, quote, after)));
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
          paragraph([{ kind: 'text', text: '* * *', look: {}, link: null }], {
            style: 'SceneBreak',
          }),
        );
      } else if (/^h[1-6]$/u.test(name)) {
        const n = Number(name[1]);
        out.push(paragraph(this.#inline(node.children), { style: style ?? `Heading${n}` }));
      } else if (name === 'p' || name === 'li') {
        out.push(paragraph(this.#inline(node.children), this.#bodyLook(style, quote, after)));
      } else if (name === 'blockquote') {
        // A quote's indents, left and right, are room a picture can't have.
        const room = this.#area.cx - TWIP * 720 * (quote + 2);
        out.push(...this.#within(room, () => this.#blocks(node.children, quote + 1, level, style)));
      } else if (name === 'ul' || name === 'ol') {
        out.push(...this.#list(node, quote, level, style));
      } else if (name === 'pre') {
        // HTML ignores a line end just after <pre> (the writer adds one before code that starts blank).
        const code = text(node).replace(/^\n/u, '');
        // Courier by the run, so code in a list or a footnote keeps it too.
        const pieces: Piece[] = [{ kind: 'text', text: code, look: { code: true }, link: null }];
        out.push(paragraph(pieces, { style: style ?? 'SourceCode' }, true));
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

  /** `run`, with a picture drawn no wider than `room` (EMU) while it runs. */
  #within<T>(room: number, run: () => T): T {
    const before = this.#room;
    this.#room = Math.min(before, Math.max(room, TWIP * 720));
    try {
      return run();
    } finally {
      this.#room = before;
    }
  }

  #list(list: HtmlElement, quote: number, level: number, style: string | null): string[] {
    // An item is indented by its level: room a picture can't have.
    const room = this.#area.cx - TWIP * 720 * (level + 1);
    return this.#within(room, () => this.#items(list, quote, level, style));
  }

  #items(list: HtmlElement, quote: number, level: number, style: string | null): string[] {
    let id = 1; // the bullets'
    if (list.name === 'ol') {
      id = this.numberedLists.length + 2;
      const start = Number.parseInt(list.attrs.start ?? '1', 10);
      this.numberedLists.push({ level, start: Number.isSafeInteger(start) ? start : 1 });
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
        out.push(paragraph(pieces, { style: style ?? 'ListParagraph', list: { id, level } }));
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
        const pieces = cell
          ? this.#within(TWIP * (width - 216), () => this.#inline(cell.children, look))
          : [];
        return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${paragraph(pieces, { style: 'TableText' })}</w:tc>`;
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
      else if (name === 'img') {
        const drawing = this.#drawing(node.attrs.src ?? '', node.attrs.alt ?? '');
        if (drawing) pieces.push({ kind: 'image', drawing, link });
        else pieces.push({ kind: 'text', text: node.attrs.alt ?? '', look, link });
      } else if (name === 'a' && node.attrs.class === 'noteref') {
        const n = Number(text(node));
        const id = this.#inNote ? null : this.#footnote(n);
        if (id !== null) pieces.push({ kind: 'note', n: id });
        else pieces.push({ kind: 'text', text: String(n), look: { ...look, sup: true }, link });
      } else if (name === 'q') {
        // A browser draws <q>'s quotation marks itself; Word needs them as words.
        pieces.push({ kind: 'text', text: '“', look, link });
        for (const child of node.children) walk(child, look, link);
        pieces.push({ kind: 'text', text: '”', look, link });
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
}
