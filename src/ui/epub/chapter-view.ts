// A book's chapter drawn (#40): its cleaned nodes (core/epub) made into
// elements by the shared drawing (../draw-clean.ts), its pictures read from
// the book's zip and shown as the window's own copies (blob: URLs, as a
// note's images are). Each picture takes its room before it's shown, from
// its own header, so a place shown in the chapter doesn't drift as they
// arrive (Phase 2); one whose header Eien doesn't read is decoded, and the
// fonts loaded, before a place is shown (`settled`). Only the chapter in sight is drawn; its copies are let go
// when another takes its place, or the page closes.

import { type Chapter, type Epub, isRefusal } from '../../core/epub';
import { drawClean } from '../draw-clean';

export interface DrawnChapter {
  readonly element: DocumentFragment;
  /**
   * Laid out where it will stay, in `chapter` (where it's drawn): its pictures
   * at their size (those Eien couldn't size from their headers decoded), and
   * the fonts it's set in loaded.
   */
  settled(chapter: HTMLElement): Promise<void>;
  /** Its pictures' copies let go. */
  release(): void;
}

/**
 * The fonts `chapter` is set in loaded: laid out first, as a face starts
 * loading only when something asks for it (one arriving later shows the place
 * again, ./place-keeper.ts).
 */
const fontsLoaded = (chapter: HTMLElement): Promise<unknown> => {
  void chapter.offsetHeight;
  return typeof document.fonts === 'object' && document.fonts.status !== 'loaded'
    ? document.fonts.ready
    : Promise.resolve();
};

/**
 * `chapter` of `epub`, drawn with its pictures, after Eien's `front` matter if
 * it's the first (./front-matter.ts); a picture that can't be read is its words.
 */
export async function drawChapter(
  epub: Epub,
  chapter: Chapter,
  front: HTMLElement | null = null,
): Promise<DrawnChapter> {
  const urls = new Map<string, string>();
  const sizes = new Map<string, { readonly width: number; readonly height: number }>();
  for (const path of chapter.images) {
    const image = await epub.image(path);
    if (isRefusal(image)) continue;
    const url = URL.createObjectURL(new Blob([image.bytes.slice()], { type: image.type }));
    urls.set(path, url);
    if (image.size) sizes.set(url, image.size);
  }
  const element = drawClean(chapter.nodes, { image: (src) => urls.get(src) ?? null });
  if (front) element.prepend(front);
  const unsized: HTMLImageElement[] = [];
  for (const img of element.querySelectorAll('img')) {
    // The book's own copies, already in memory: nothing to wait for off the screen.
    img.loading = 'eager';
    const size = sizes.get(img.getAttribute('src') ?? '');
    if (!size) {
      unsized.push(img);
      continue;
    }
    img.width = size.width;
    img.height = size.height;
  }
  return {
    element,
    settled: async (chapter) => {
      await Promise.all([
        ...unsized.map((img) => img.decode().catch(() => {})),
        fontsLoaded(chapter),
      ]);
    },
    release: () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    },
  };
}
