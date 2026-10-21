// Word (.docx; spec §8): the parts of a WordprocessingML package around
// the body ./docx-body.ts writes. Word's own style names (heading 1, Quote,
// List Paragraph, footnote text), so Word, Pages, LibreOffice and Google
// Docs each read them as theirs; 12-point Times New Roman; each chapter from
// a new page; the page number at the foot.

import { chaptersOf, type ExportRequest, languageTag, pageSizeOf, utcSeconds } from './book';
import { DocxWriter } from './docx-body';
import { IMAGE_KINDS } from './images';
import { escapeXml } from './xml';
import { zipStore } from './zip';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Page sizes in twentieths of a point. */
const PAGES = { a4: [11906, 16838], letter: [12240, 15840] } as const;

const style = (type: string, id: string, name: string, inner: string, extra = '') =>
  `<w:style w:type="${type}" w:styleId="${id}"${extra}><w:name w:val="${name}"/>${inner}</w:style>`;

/** A paragraph style on Normal, with no first-line indent. */
const flush = (id: string, name: string, pPr: string, rPr = '', next = '') =>
  style(
    'paragraph',
    id,
    name,
    `<w:basedOn w:val="Normal"/>${next ? `<w:next w:val="${next}"/>` : ''}<w:qFormat/><w:pPr>${pPr.replace('<IND/>', '<w:ind w:firstLine="0"/>')}</w:pPr>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}`,
  );

const size = (halfPoints: number) => `<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`;

function styles(language: string): string {
  const headings = [2, 3, 4, 5, 6].map((n) =>
    flush(
      `Heading${n}`,
      `heading ${n}`,
      `<w:keepNext/><w:spacing w:before="360" w:after="120"/><IND/><w:outlineLvl w:val="${n - 1}"/>`,
      `<w:b/><w:bCs/>${size(n === 2 ? 28 : 24)}`,
      'FirstParagraph',
    ),
  );
  return `${XML}<w:styles xmlns:w="${W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>${size(24)}<w:lang w:val="${escapeXml(language)}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
${style('paragraph', 'Normal', 'Normal', '<w:qFormat/><w:pPr><w:ind w:firstLine="432"/></w:pPr>', ' w:default="1"')}
${flush('FirstParagraph', 'First Paragraph', '<IND/>', '', 'Normal')}
${flush('Title', 'Title', '<w:spacing w:before="2880" w:after="480"/><IND/><w:jc w:val="center"/>', size(56), 'Normal')}
${flush('Heading1', 'heading 1', '<w:keepNext/><w:pageBreakBefore/><w:spacing w:before="1440" w:after="480"/><IND/><w:jc w:val="center"/><w:outlineLvl w:val="0"/>', size(36), 'FirstParagraph')}
${headings.join('\n')}
${flush('SceneBreak', 'Scene Break', '<w:spacing w:before="240" w:after="240"/><IND/><w:jc w:val="center"/>', '', 'FirstParagraph')}
${flush('Quote', 'Quote', '<w:spacing w:before="120" w:after="120"/><w:ind w:left="720" w:right="720" w:firstLine="0"/>')}
${flush('ListParagraph', 'List Paragraph', '<w:ind w:left="720" w:firstLine="0"/>')}
${flush('SourceCode', 'Source Code', '<w:spacing w:before="120" w:after="120" w:line="240" w:lineRule="auto"/><IND/>', `<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>${size(20)}`)}
${flush('TableText', 'Table Text', '<IND/>')}
${flush('FootnoteText', 'footnote text', '<w:spacing w:line="240" w:lineRule="auto"/><IND/>', size(20))}
${style('character', 'DefaultParagraphFont', 'Default Paragraph Font', '<w:uiPriority w:val="1"/><w:semiHidden/>', ' w:default="1"')}
${style('character', 'FootnoteReference', 'footnote reference', '<w:rPr><w:vertAlign w:val="superscript"/></w:rPr>')}
${style('character', 'Hyperlink', 'Hyperlink', '<w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>')}
${style('table', 'TableNormal', 'Normal Table', '<w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>', ' w:default="1"')}
</w:styles>`;
}

const BULLETS = ['•', '◦', '▪'];

/** Bullets (list 1), and one numbering per numbered list, each from its own first number. */
function numbering(numbered: readonly { level: number; start: number }[]): string {
  const levels = (numbered: boolean) =>
    Array.from({ length: 9 }, (_, k) => {
      const format = numbered
        ? `<w:numFmt w:val="decimal"/><w:lvlText w:val="%${k + 1}."/>`
        : `<w:numFmt w:val="bullet"/><w:lvlText w:val="${BULLETS[k % 3]}"/>`;
      return `<w:lvl w:ilvl="${k}"><w:start w:val="1"/>${format}<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (k + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
    }).join('');
  const lists = numbered.map(
    ({ level, start }, i) =>
      `<w:num w:numId="${i + 2}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="${Math.min(level, 8)}"><w:startOverride w:val="${start}"/></w:lvlOverride></w:num>`,
  );
  return `${XML}<w:numbering xmlns:w="${W}">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${levels(false)}</w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${levels(true)}</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
${lists.join('\n')}
</w:numbering>`;
}

const SEPARATORS = ['separator', 'continuationSeparator']
  .map(
    (type, i) =>
      `<w:footnote w:type="${type}" w:id="${i - 1}"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:${type}/></w:r></w:p></w:footnote>`,
  )
  .join('\n');

const SETTINGS = `${XML}<w:settings xmlns:w="${W}"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;

const FOOTER = `${XML}<w:ftr xmlns:w="${W}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;

const TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
const CONTENT_TYPES = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Default Extension="jpg" ContentType="image/jpeg"/>
<Default Extension="gif" ContentType="image/gif"/>
<Override PartName="/word/document.xml" ContentType="${TYPE}.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="${TYPE}.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="${TYPE}.numbering+xml"/>
<Override PartName="/word/footnotes.xml" ContentType="${TYPE}.footnotes+xml"/>
<Override PartName="/word/settings.xml" ContentType="${TYPE}.settings+xml"/>
<Override PartName="/word/footer1.xml" ContentType="${TYPE}.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const PACKAGE_RELS = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

const relationships = (rels: readonly string[]) =>
  `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n${rels.join('\n')}\n</Relationships>`;

/** The book (or note) as a Word document's bytes. */
export function docx(request: ExportRequest): Uint8Array {
  const language = languageTag(request.language);
  const [width, height] = PAGES[pageSizeOf(request.language)];
  const { chapters, images } = chaptersOf(request, false);
  // The text's area: the page less its inch margins (a twip is 635 EMU).
  const writer = new DocxWriter(images, { cx: (width - 2880) * 635, cy: (height - 2880) * 635 });
  const title = request.book
    ? [
        `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(request.title)}</w:t></w:r></w:p>`,
      ]
    : [];
  const body = chapters.flatMap((chapter, i) => writer.chapter(chapter, i === 0 && !request.book));
  const media = images.map(
    (image, n) => `media/image-${n + 1}.${IMAGE_KINDS[image.info.kind].extension}`,
  );
  // A book's title page shows no page number (Word's "different first page", with no footer for it).
  const section = `<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="${width}" w:h="${height}"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>${request.book ? '<w:titlePg/>' : ''}</w:sectPr>`;
  const document = `${XML}<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}"><w:body>${[...title, ...body].join('\n')}${section}</w:body></w:document>`;
  // Links and images, the body's and the footnotes': each part has them all.
  const links = [
    ...writer.links.map(
      (href, i) =>
        `<Relationship Id="rIdLink${i + 1}" Type="${REL}/hyperlink" Target="${escapeXml(href)}" TargetMode="External"/>`,
    ),
    ...media.map(
      (target, n) => `<Relationship Id="rIdImage${n + 1}" Type="${REL}/image" Target="${target}"/>`,
    ),
  ];
  const parts = ['styles', 'numbering', 'footnotes', 'settings'].map(
    (part) => `<Relationship Id="rId${part}" Type="${REL}/${part}" Target="${part}.xml"/>`,
  );
  const footer = `<Relationship Id="rIdFooter" Type="${REL}/footer" Target="footer1.xml"/>`;
  const created = utcSeconds(request.date);
  const core = `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(request.title)}</dc:title><dc:language>${escapeXml(language)}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`;
  return zipStore(
    [
      { path: '[Content_Types].xml', data: CONTENT_TYPES },
      { path: '_rels/.rels', data: PACKAGE_RELS },
      { path: 'word/document.xml', data: document },
      { path: 'word/_rels/document.xml.rels', data: relationships([...parts, footer, ...links]) },
      { path: 'word/styles.xml', data: styles(language) },
      { path: 'word/numbering.xml', data: numbering(writer.numberedLists) },
      {
        path: 'word/footnotes.xml',
        data: `${XML}<w:footnotes xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}">\n${SEPARATORS}\n${writer.footnotes.join('\n')}\n</w:footnotes>`,
      },
      // A link or an image in a footnote is the footnotes part's own relationship.
      { path: 'word/_rels/footnotes.xml.rels', data: relationships(links) },
      ...images.map((image, n) => ({ path: `word/${media[n]}`, data: image.bytes })),
      { path: 'word/settings.xml', data: SETTINGS },
      { path: 'word/footer1.xml', data: FOOTER },
      { path: 'docProps/core.xml', data: core },
    ],
    request.date,
  );
}
