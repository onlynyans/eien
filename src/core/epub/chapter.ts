// One of a book's files read as a chapter (#40): its XHTML parsed by Eien's
// own reader, Calibre's SVG-framed pictures unwrapped, kept to what words
// need by the shared cleaner under the book's rules, its first line named,
// and a chapter that's only a picture kept to its pictures.
// What's drawn is these nodes, never the book's HTML; the pictures they name
// are paths in the zip, which the window reads and shows from its own copies.

import { type CleanNode, cleanParsed, parseHtml } from '../html';
import { epubRules } from './epub-rules';
import { markFirstLine } from './first-line';
import { picturePage } from './picture-page';
import { unwrapSvgPlates } from './svg-plate';
import { localNames } from './xml-nodes';
import { xmlText } from './xml-text';

export interface Chapter {
  readonly nodes: readonly CleanNode[];
  /** The zip paths of the pictures it shows, each once. */
  readonly images: readonly string[];
}

/** Every image's src in `nodes`. */
function imagesIn(nodes: readonly CleanNode[], into: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.kind !== 'element') continue;
    if (node.name === 'img' && node.attrs.src) into.add(node.attrs.src);
    imagesIn(node.children, into);
  }
  return into;
}

/**
 * The chapter at `path`, from its bytes; `holds`, whether the zip has an
 * entry, and `isChapter`, whether it's in the spine (a link may go there).
 */
export function chapterOf(
  bytes: Uint8Array,
  path: string,
  holds: (name: string) => boolean,
  isChapter: (name: string) => boolean = () => false,
): Chapter {
  const parsed = unwrapSvgPlates(localNames(parseHtml(xmlText(bytes))));
  const nodes = picturePage(markFirstLine(cleanParsed(parsed, epubRules(path, holds, isChapter))));
  return { nodes, images: [...imagesIn(nodes, new Set())] };
}
