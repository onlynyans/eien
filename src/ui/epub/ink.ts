// Ink over a book's words (#40, Phase 5): its highlights' pencil line and
// Find's matches (Phase 5c), painted by the CSS Custom Highlight API over the drawn
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
import { type Bounds, boundsOf, type Walked } from './chapter-range';

/** The inks, each a `::highlight()` in ./ink.css: a highlight's, Find's matches (Phase 5c), and the match it's on. */
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

/** A range's ends, as a StaticRange takes them. */
const rangeInit = (bounds: Bounds): StaticRangeInit => ({
  startContainer: bounds.startContainer,
  startOffset: bounds.startOffset,
  endContainer: bounds.endContainer,
  endOffset: bounds.endOffset,
});

/** One page's ink of one name: its ranges among every page's. */
export class Ink {
  readonly #name: InkName;
  #mine: readonly StaticRange[] = [];

  constructor(name: InkName) {
    this.#name = name;
  }

  /** `spans` of the drawn chapter `walk` holds inked, in place of what this ink painted before. */
  paint(walk: Walked, spans: readonly Span[]): void {
    const highlight = this.#forget();
    // Without the API nothing is painted, nor any range made (StaticRange may be missing too).
    if (!highlight || spans.length === 0) return;
    this.#mine = spans.flatMap((span) => {
      const bounds = boundsOf(walk, span);
      return bounds ? [new StaticRange(rangeInit(bounds))] : [];
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

/** One ink's spans for a turn's copy: offsets in the chapter. */
export interface CopyInk {
  readonly name: InkName;
  readonly spans: readonly Span[];
}

/**
 * A turn's copy of the page (walked), its words from offset `from` in the
 * chapter on, with each ink's spans wrapped in elements of its own. Every
 * cut is found in the one walk before any text moves, then each piece split
 * from its end, so one ink's wrapping never shifts another's; words two inks
 * share are wrapped in both. The copy is inert and never counted, so
 * wrapping its text moves no place.
 */
export function inkCopy(walk: Walked, from: number, inks: readonly CopyInk[]): void {
  // Each piece's inked runs: where in it, and which ink.
  const runs = new Map<number, { start: number; end: number; name: InkName }[]>();
  for (const { name, spans } of inks) {
    for (const span of spans) {
      const bounds = boundsOf(walk, { from: span.from - from, to: span.to - from });
      if (!bounds) continue;
      for (let i = bounds.first; i <= bounds.last; i++) {
        const piece = walk.pieces[i] as Text;
        const start = i === bounds.first ? bounds.startOffset : 0;
        const end = i === bounds.last ? bounds.endOffset : piece.length;
        runs.set(i, [...(runs.get(i) ?? []), { start, end, name }]);
      }
    }
  }
  for (const [i, inked] of runs) {
    const piece = walk.pieces[i] as Text;
    const cuts = [...new Set([0, piece.length, ...inked.flatMap((run) => [run.start, run.end])])]
      .filter((cut) => cut >= 0 && cut <= piece.length)
      .sort((a, b) => b - a);
    // From the piece's end, so each split leaves the cuts before it where they were.
    for (let c = 0; c < cuts.length - 1; c++) {
      const end = cuts[c] as number;
      const start = cuts[c + 1] as number;
      const names = new Set(
        inked.filter((run) => run.start <= start && end <= run.end).map((run) => run.name),
      );
      if (names.size === 0 || start === end) continue;
      const words = piece.splitText(start);
      if (words.length > end - start) words.splitText(end - start);
      const { parentNode: holder, nextSibling: next } = words;
      // Each ink round the last, the words innermost.
      let wrapped: Node = words;
      for (const name of names) {
        const ink = document.createElement('span');
        ink.setAttribute(INKED, name);
        ink.append(wrapped);
        wrapped = ink;
      }
      holder?.insertBefore(wrapped, next);
    }
  }
}
