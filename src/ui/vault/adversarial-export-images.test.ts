// Adversarial: the images a book's export reads (spec §8: "Images from the
// vault go in"; one left out is its description and is counted in the news).
// ExportImages finds a note's images by parsing the whole note at once, but
// the chapter writes each footnote as a document of its own: an image in a
// footnote the whole-note parse doesn't see as one is never read, so it goes
// as its description and the news says nothing.

import { describe, expect, it } from 'vitest';
import { png } from '../../../tests/support/images';
import { readZip } from '../../../tests/support/read-zip';
import { epub } from '../../core/export';
import { ExportImages } from './export-images';

const DOT = png(4, 4);

/** The note "Book/One.md" exported as an EPUB, its images read from a vault holding Book/dot.png. */
async function exported(markdown: string): Promise<{ chapter: string; left: number }> {
  const images = new ExportImages(async (path) => (path === 'Book/dot.png' ? DOT : null));
  const carried = await images.of('Book/One.md', markdown);
  const zip = readZip(
    epub({
      title: 'One',
      notes: [{ title: 'One', markdown, images: carried }],
      book: false,
      quotes: 'straight',
      language: 'en-US',
      key: 'k',
      date: new Date(0),
    }),
  );
  return { chapter: zip.text('OEBPS/chapter-1.xhtml'), left: images.left };
}

describe('an image in a footnote, from the vault', () => {
  it('is carried when the footnote begins with it', async () => {
    // With no space in it, the whole note reads "[^1]: ![dot](dot.png)" as a link
    // reference definition (label "^1"), so it finds no image there.
    const { chapter, left } = await exported('A dot.[^1]\n\n[^1]: ![dot](dot.png)');
    expect({
      left,
      carried: chapter.includes('<img src="images/image-1.png" alt="dot" />'),
    }).toEqual({ left: 0, carried: true });
  });

  it('is carried in a later paragraph of the footnote', async () => {
    // The whole note reads the footnote's indented paragraph as code.
    const { chapter, left } = await exported(
      'A dot.[^1]\n\n[^1]: Look closely:\n\n    ![A dot](dot.png)',
    );
    expect({
      left,
      carried: chapter.includes('<img src="images/image-1.png" alt="A dot" />'),
    }).toEqual({ left: 0, carried: true });
  });
});

describe('a note with one long paragraph', () => {
  // Spec §8: "A paragraph of more than 64 lines … goes as paragraphs of 64, as the index
  // reads it (§4): the parser takes seconds over one." The chapter is cut so; the images'
  // own reading of the note isn't, and the window waits on it before every export.
  it('has its images read as quickly as its chapter is written', { timeout: 60_000 }, async () => {
    const markdown = Array.from({ length: 24_000 }, (_, i) => `[a] [b] [c] line ${i}`).join('\n');
    let at = performance.now();
    epub({
      title: 'One',
      notes: [{ title: 'One', markdown }],
      book: false,
      quotes: 'straight',
      language: 'en-US',
      key: 'k',
      date: new Date(0),
    });
    const written = performance.now() - at;
    at = performance.now();
    await new ExportImages(async () => null).of('Book/One.md', markdown);
    const read = performance.now() - at;
    // Today: about 6 s to find no images, against a fraction of a second for the whole EPUB.
    expect(read).toBeLessThan(Math.max(1000, 3 * written));
  });
});
