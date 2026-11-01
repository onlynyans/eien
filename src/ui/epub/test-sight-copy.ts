// A turn's copy's words (./sight-copy.ts) on the DOM tests' own layout:
// happy-dom lays nothing out, so each test says where each thing's first box
// is. Columns are 340px apart (300 and a 40px gap).

import type { BoxOf, SightCopyOf } from './sight-copy';
import { sightCopy } from './sight-copy';

export const PITCH = 340;
/** A quarter of a layout unit: what the spacer's height is given over its measure. */
export const OVER = 1 / 256;

export interface Place {
  readonly column: number;
  readonly top?: number;
}

/** `html` as a chapter laid from the window's left, each text named standing where it's placed. */
export function chapterOf(html: string, at: Readonly<Record<string, Place>>) {
  const box = document.createElement('div');
  const chapter = document.createElement('div');
  chapter.innerHTML = html;
  box.append(chapter);
  document.body.append(box);
  chapter.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
  /** A node's box: its own words' place, or else the first named text in it or after it. */
  const boxOf: BoxOf = (node) => {
    const walk = document.createTreeWalker(chapter, NodeFilter.SHOW_TEXT);
    for (let text = walk.nextNode(); text; text = walk.nextNode()) {
      const follows =
        text === node ||
        node.contains(text) ||
        node.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING;
      const place = at[text.textContent?.trim() ?? ''];
      if (!follows || !place) continue;
      return { left: place.column * PITCH + 10, top: place.top ?? 0 };
    }
    return null;
  };
  return { box, chapter, boxOf };
}

/** The sight beginning at column `column`, one page wide, the page moved there. */
export const sight = (box: HTMLElement, column: number, scale = 1): SightCopyOf => ({
  box,
  from: (column * PITCH - 20) * scale,
  past: ((column + 1) * PITCH - 20) * scale,
  at: column * PITCH,
  pitch: PITCH,
  scale,
});

export function copied(chapter: HTMLElement, of: SightCopyOf) {
  const sight = sightCopy(chapter, of);
  if (!sight) throw new Error('no copy');
  const copy = document.createElement('div');
  copy.append(sight.words);
  return { copy, shift: sight.shift, from: sight.from };
}
