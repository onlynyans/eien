// A book's chapter drawn (#40): its cleaned nodes (core/epub) made into
// elements by the shared drawing (../draw-clean.ts), its pictures read from
// the book's zip and shown as the window's own copies (blob: URLs, as a
// note's images are). Only the chapter in sight is drawn; its copies are let
// go when another takes its place, or the page closes.

import { type Chapter, type Epub, isRefusal } from '../../core/epub';
import { drawClean } from '../draw-clean';

export interface DrawnChapter {
  readonly element: DocumentFragment;
  /** Its pictures' copies let go. */
  release(): void;
}

/** `chapter` of `epub`, drawn with its pictures; a picture that can't be read is its words. */
export async function drawChapter(epub: Epub, chapter: Chapter): Promise<DrawnChapter> {
  const urls = new Map<string, string>();
  for (const path of chapter.images) {
    const image = await epub.image(path);
    if (isRefusal(image)) continue;
    urls.set(path, URL.createObjectURL(new Blob([image.bytes.slice()], { type: image.type })));
  }
  return {
    element: drawClean(chapter.nodes, { image: (src) => urls.get(src) ?? null }),
    release: () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    },
  };
}
