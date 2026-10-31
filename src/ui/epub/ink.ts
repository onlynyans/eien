// Ink over a book's words (#40, Phase 5): its highlights' pencil line, and
// Find's matches, painted by the CSS Custom Highlight API over the drawn
// chapter's own text, so no element is added among the words a place counts
// (a span round them would split a piece, and could leave a blank one
// uncounted, moving every offset after it). The window has one registry, so
// each name is one Highlight for the document, which every page adds its own
// ranges to and takes its own from: two pages never wipe each other's. Where
// the API is missing (an older WebView, the DOM tests' window) nothing is
// painted, and what else the page draws (a highlight's tick) still shows.
// A turn's copy of the page is inked instead (`inkCopy`): it's thrown away,
// never measured, and a curl clones it, which a painted range never follows.

import type { Span } from '../../core/epub';
import { boundsOf, walked } from './chapter-range';

/** The inks, each a `::highlight()` in ./ink.css. */
export type InkName = 'epub-highlight' | 'epub-found' | 'epub-found-current';

/** Marks a turn's copy's inked words with their ink's name (./ink.css). */
export const INKED = 'data-ink';

/** The document's Highlight named `name`, made the first time; null without the API. */
function shared(name: InkName): Highlight | null {
  const registry = globalThis.CSS?.highlights;
  if (!registry || typeof Highlight === 'undefined' || typeof StaticRange === 'undefined')
    return null;
  const kept = registry.get(name);
  if (kept) return kept;
  const made = new Highlight();
  registry.set(name, made);
  return made;
}

/** One page's ink of one name: its ranges among every page's. */
export class Ink {
  readonly #name: InkName;
  #mine: readonly StaticRange[] = [];

  constructor(name: InkName) {
    this.#name = name;
  }

  /** `spans` of the drawn `chapter` inked, in place of what this ink painted before. */
  paint(chapter: HTMLElement, spans: readonly Span[]): void {
    const highlight = this.#forget();
    // Without the API nothing is painted, nor any range made (StaticRange may be missing too).
    if (!highlight || spans.length === 0) return;
    const walk = walked(chapter);
    this.#mine = spans.flatMap((span) => {
      const bounds = boundsOf(walk, span);
      return bounds ? [new StaticRange(bounds)] : [];
    });
    for (const range of this.#mine) highlight.add(range);
  }

  /** Nothing inked: the chapter let go (its text kept by no range), or the page gone. */
  clear(): void {
    this.#forget();
  }

  /** This page's ranges taken from the document's Highlight: the Highlight, or null without the API. */
  #forget(): Highlight | null {
    const highlight = shared(this.#name);
    for (const range of this.#mine) highlight?.delete(range);
    this.#mine = [];
    return highlight;
  }
}

/**
 * A turn's `copy` of the page, its words from offset `from` in the chapter
 * on, with `spans` (offsets in the chapter) inked as `name` in its own
 * elements: each wrapped where it falls. The copy is inert and never
 * counted, so wrapping its text moves no place.
 */
export function inkCopy(
  copy: HTMLElement,
  from: number,
  name: InkName,
  spans: readonly Span[],
): void {
  if (spans.length === 0) return;
  const walk = walked(copy);
  // Last first, so a wrap never moves the text an earlier span's bounds name; spans that overlap
  // (a file from elsewhere) joined first, so none wraps inside another.
  const shown = joinedSpans(spans)
    .map((span) => boundsOf(walk, { from: span.from - from, to: span.to - from }))
    .filter((bounds) => bounds !== null)
    .reverse();
  for (const bounds of shown) {
    const pieces = walk.pieces;
    const first = pieces.indexOf(bounds.startContainer);
    const last = pieces.indexOf(bounds.endContainer);
    for (let i = last; i >= first; i--) {
      const piece = pieces[i] as Text;
      const start = i === first ? bounds.startOffset : 0;
      const end = i === last ? bounds.endOffset : piece.length;
      const words = piece.splitText(start);
      words.splitText(end - start);
      const ink = document.createElement('span');
      ink.setAttribute(INKED, name);
      words.replaceWith(ink);
      ink.append(words);
    }
  }
}

/** `spans` in order, those that overlap joined. */
function joinedSpans(spans: readonly Span[]): Span[] {
  const joined: Span[] = [];
  for (const span of [...spans].sort((a, b) => a.from - b.from)) {
    const last = joined.at(-1);
    if (last && span.from < last.to)
      joined[joined.length - 1] = { from: last.from, to: Math.max(last.to, span.to) };
    else joined.push(span);
  }
  return joined;
}
