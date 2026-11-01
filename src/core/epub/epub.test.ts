import { describe, expect, it } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { inflateRaw } from '../../platform/inflate';
import { type CleanNode, plainOf } from '../html';
import type { Chapter } from './chapter';
import { type Epub, epubKey, openEpub } from './epub';
import { isRefusal, type Refusal, refusalWords } from './refusal';
import { openZip } from './zip-read';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);
const bytesOf = (name: string) => EPUBS[name] as Uint8Array;

async function opened(name: string): Promise<Epub> {
  const book = await openEpub(bytesOf(name), inflateRaw);
  if (isRefusal(book)) throw new Error(`${name}: ${book.detail}`);
  return book;
}

async function chapter(book: Epub, index: number): Promise<Chapter> {
  const read = await book.chapter(index);
  if (isRefusal(read)) throw new Error(read.detail);
  return read;
}

/** Every element's name and part, depth first. */
const elements = (nodes: readonly CleanNode[]): { name: string; part?: string }[] =>
  nodes.flatMap((node) =>
    node.kind === 'text'
      ? []
      : [
          { name: node.name, ...(node.part ? { part: node.part } : {}) },
          ...elements(node.children),
        ],
  );

describe('openEpub: the plain book, Eien’s own export', () => {
  it('reads its title, author and contents', async () => {
    const book = await opened('plain.epub');
    expect(book.title).toBe('Pride and Prejudice');
    expect(book.language).toBe('en');
    expect(book.contents.map((row) => row.title)).toEqual([
      'Chapter I',
      'Chapter II',
      'Chapter III',
    ]);
    // The title page is in the spine, before the chapters, and not in the contents.
    expect(book.contents.map((row) => row.spine)).toEqual([1, 2, 3]);
    expect(book.printPages).toEqual([]);
  });

  it('cleans a chapter, its title and first line named, its pictures paths in the zip', async () => {
    const book = await opened('plain.epub');
    const three = await chapter(book, 3);
    expect(plainOf(three.nodes)).toContain('Not all that Mrs. Bennet');
    expect(elements(three.nodes).filter((each) => each.part)).toEqual([
      { name: 'h1', part: 'chapter-title' },
      { name: 'p', part: 'first-line' },
      expect.objectContaining({
        name: expect.stringMatching(/^(?:p|div|figure)$/u),
        part: 'plate',
      }),
    ]);
    expect(three.images).toEqual(['OEBPS/images/image-2.jpg']);
    const picture = await book.image('OEBPS/images/image-2.jpg');
    expect(picture).toMatchObject({ type: 'image/jpeg', size: { width: 1, height: 1 } });
  });

  it('sizes each spine item by its entry, inflated: how much of the book it is', async () => {
    const book = await opened('plain.epub');
    expect(book.spine.every((item) => Number.isSafeInteger(item.size) && item.size > 0)).toBe(true);
    const three = await chapter(book, 3);
    // A chapter's file is at least its words.
    expect(book.spine[3]?.size).toBeGreaterThan(plainOf(three.nodes).trim().length);
  });

  it('keys the book by what it holds: the same whatever the file is called', async () => {
    const book = await opened('plain.epub');
    expect(book.key).toMatch(/^[0-9a-f]{16}$/u);
    const again = await openEpub(bytesOf('plain.epub').slice(), inflateRaw);
    expect(isRefusal(again) ? null : again.key).toBe(book.key);
    expect((await opened('epub2.epub')).key).not.toBe(book.key);
  });
});

describe('openEpub: EPUB 2 and 3', () => {
  it('reads an EPUB 2 book’s NCX, a part over its chapters, and its pageList', async () => {
    const book = await opened('epub2.epub');
    expect(book.contents.map((row) => [row.title, row.depth])).toEqual([
      ['Volume I', 0],
      ['Chapter I', 1],
      ['Chapter II', 1],
      ['Chapter III', 1],
    ]);
    expect(book.printPages.map((page) => page.label)).toEqual(['1', '2', '3']);
    expect(book.printPages[2]).toMatchObject({ path: 'OEBPS/text/chapter-3.xhtml', fragment: '' });
  });

  it('reads an EPUB 3 nav’s page-list, each page’s place in its chapter', async () => {
    const book = await opened('page-list.epub');
    expect(book.contents.map((row) => row.path)).toEqual([
      'OEBPS/text/chapter-1.xhtml',
      'OEBPS/text/chapter-2.xhtml',
      'OEBPS/text/chapter-3.xhtml',
    ]);
    expect(book.printPages.map((page) => page.label)).toEqual(['xii', '1', '2', '3', '4', '5']);
    expect(book.printPages[0]).toEqual({
      label: 'xii',
      path: 'OEBPS/text/chapter-1.xhtml',
      fragment: '',
    });
    expect(book.printPages[3]).toEqual({
      label: '3',
      path: 'OEBPS/text/chapter-2.xhtml',
      fragment: 'page-3',
    });
  });
});

describe('openEpub: pictures', () => {
  it('names a chapter that’s only a picture a plate', async () => {
    const book = await opened('plates.epub');
    const plate = await chapter(book, 0);
    expect(elements(plate.nodes)).toEqual([{ name: 'div', part: 'plate' }, { name: 'img' }]);
    expect(plate.images).toEqual(['images/black-horse.jpg']);
  });

  it('unwraps Calibre’s SVG frame to a plain picture', async () => {
    const book = await opened('plates.epub');
    const framed = await chapter(book, 1);
    expect(elements(framed.nodes)).toEqual([{ name: 'div', part: 'plate' }, { name: 'img' }]);
    expect(framed.images).toEqual(['images/headpiece.jpg']);
  });

  it('names a figure’s caption, a scene break and the first line after the title', async () => {
    const book = await opened('plates.epub');
    const parts = elements((await chapter(book, 2)).nodes).filter((each) => each.part);
    expect(parts).toEqual([
      { name: 'h1', part: 'chapter-title' },
      { name: 'figure', part: 'plate' },
      { name: 'figcaption', part: 'caption' },
      { name: 'p', part: 'first-line' },
      { name: 'hr', part: 'scene-break' },
    ]);
  });
});

describe('openEpub: refusals', () => {
  const refusal = async (name: string) => {
    const book = await openEpub(bytesOf(name), inflateRaw);
    return isRefusal(book) ? book : null;
  };

  it('refuses a book locked with DRM, and says so', async () => {
    const locked = (await refusal('drm.epub')) as Refusal;
    expect(locked.refused).toBe('locked');
    expect(refusalWords(locked)).toMatch(/DRM/u);
  });

  it('refuses a book with Adobe’s, Apple’s or Readium LCP’s lock file', async () => {
    const { handZip } = await import('../../../tests/support/epub-zip');
    for (const lock of ['META-INF/rights.xml', 'META-INF/sinf.xml', 'META-INF/license.lcpl']) {
      const bytes = handZip([
        { name: 'META-INF/container.xml', data: '<container/>' },
        { name: lock, data: '{}' },
      ]);
      expect(await openEpub(bytes, inflateRaw), lock).toMatchObject({ refused: 'locked' });
    }
  });

  it('opens a book whose fonts are only obfuscated: that isn’t DRM', async () => {
    const { handZip } = await import('../../../tests/support/epub-zip');
    const plain = await openEpub(bytesOf('page-list.epub'), inflateRaw);
    expect(isRefusal(plain)).toBe(false);
    const { openZip: open } = await import('./zip-read');
    const zip = open(bytesOf('page-list.epub'), inflateRaw);
    if (isRefusal(zip)) throw new Error(zip.detail);
    const entries = await Promise.all(
      zip.entries.map(async (entry) => ({
        name: entry.name,
        data: (await zip.read(entry.name, 1e7)) as Uint8Array,
      })),
    );
    const fonts = `<encryption><EncryptedData><EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/><CipherData><CipherReference URI="OEBPS/font.otf"/></CipherData></EncryptedData></encryption>`;
    const withFonts = handZip([...entries, { name: 'META-INF/encryption.xml', data: fonts }]);
    expect(isRefusal(await openEpub(withFonts, inflateRaw))).toBe(false);
  });

  it('refuses a zip bomb before inflating it', async () => {
    expect(await refusal('bomb.epub')).toMatchObject({ refused: 'too-large' });
  });

  it('refuses a name out of the zip', async () => {
    expect(await refusal('escape.epub')).toMatchObject({ refused: 'unsafe' });
  });

  it('opens a book whose header lies, and refuses the entry when it’s read', async () => {
    const zip = openZip(bytesOf('lying.epub'), inflateRaw);
    expect(isRefusal(zip)).toBe(false);
    if (!isRefusal(zip)) {
      expect(await zip.read('filler.xhtml', 2048)).toMatchObject({ refused: 'damaged' });
    }
  });

  it('refuses a zip with no container, and a package with no spine', async () => {
    const { zipStore } = await import('../export/zip');
    const noContainer = zipStore([{ path: 'mimetype', data: 'application/epub+zip' }], new Date());
    expect(await openEpub(noContainer, inflateRaw)).toMatchObject({ refused: 'not-epub' });
    const noSpine = zipStore(
      [
        {
          path: 'META-INF/container.xml',
          data: '<container><rootfiles><rootfile full-path="a.opf"/></rootfiles></container>',
        },
        { path: 'a.opf', data: '<package><manifest/><spine/></package>' },
      ],
      new Date(),
    );
    expect(await openEpub(noSpine, inflateRaw)).toMatchObject({ refused: 'empty' });
  });

  it('refuses a picture of a kind notes don’t show', async () => {
    const book = await opened('plates.epub');
    expect(await book.image('plate.xhtml')).toMatchObject({ refused: 'unsupported' });
  });
});

describe('epubKey', () => {
  it('is the same in any order, and changes with a file’s contents', () => {
    const a = { name: 'a', method: 0 as const, stored: 1, size: 1, crc: 1, offset: 0 };
    const b = { ...a, name: 'b', crc: 2 };
    expect(epubKey([a, b])).toBe(epubKey([b, a]));
    expect(epubKey([a, { ...b, crc: 3 }])).not.toBe(epubKey([a, b]));
  });
});
