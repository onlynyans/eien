import { describe, expect, it, vi } from 'vitest';
import { counted, handZip, storedDeflate, zerosDeflate } from '../../../tests/support/epub-zip';
import { inflateRaw } from '../../platform/inflate';
import { zipStore } from '../export/zip';
import { EPUB_CAPS, type EpubCaps } from './caps';
import { isRefusal, type Refusal } from './refusal';
import { type Inflate, openZip, type ZipArchive } from './zip-read';

const text = (bytes: Uint8Array | Refusal) =>
  bytes instanceof Uint8Array ? new TextDecoder().decode(bytes) : bytes;

const archive = (bytes: Uint8Array, caps?: EpubCaps, inflate: Inflate = inflateRaw) => {
  const zip = openZip(bytes, inflate, caps);
  if (isRefusal(zip)) throw new Error(zip.detail);
  return zip as ZipArchive;
};

const refusedAs = (bytes: Uint8Array, caps?: EpubCaps) => {
  const zip = openZip(bytes, inflateRaw, caps);
  return isRefusal(zip) ? zip.refused : 'opened';
};

const small = (more: Partial<EpubCaps>): EpubCaps => ({ ...EPUB_CAPS, ...more });

describe('openZip', () => {
  it('reads stored entries, as Eien’s own writer makes them', async () => {
    const zip = archive(
      zipStore(
        [
          { path: 'mimetype', data: 'application/epub+zip' },
          { path: 'OEBPS/Chapter One.xhtml', data: '<p>Words</p>' },
        ],
        new Date(2026, 0, 1),
      ),
    );
    expect(zip.entries.map((entry) => entry.name)).toEqual(['mimetype', 'OEBPS/Chapter One.xhtml']);
    expect(text(await zip.read('OEBPS/Chapter One.xhtml', 100))).toBe('<p>Words</p>');
  });

  it('reads deflated entries, with sizes after the data as streaming writers put them', async () => {
    const zip = archive(
      handZip([
        { name: 'a.xhtml', data: 'Deflated words.', method: 8 },
        { name: 'b.xhtml', data: 'And these, described after.', method: 8, descriptor: true },
      ]),
    );
    expect(text(await zip.read('a.xhtml', 100))).toBe('Deflated words.');
    expect(text(await zip.read('b.xhtml', 100))).toBe('And these, described after.');
  });

  it('inflates a fixed-Huffman stream to the byte', async () => {
    const zip = archive(
      handZip([
        {
          name: 'zeros',
          data: new Uint8Array(1 + 258 * 4),
          method: 8,
          packed: zerosDeflate(1 + 258 * 4),
        },
      ]),
    );
    const read = await zip.read('zeros', 2000);
    expect(read).toEqual(new Uint8Array(1 + 258 * 4));
  });

  it('leaves out a folder’s own entry', () => {
    const zip = archive(
      handZip([
        { name: 'OEBPS/', data: '' },
        { name: 'OEBPS/a.xhtml', data: 'x' },
      ]),
    );
    expect(zip.entries.map((entry) => entry.name)).toEqual(['OEBPS/a.xhtml']);
    expect(zip.has('OEBPS/')).toBe(false);
  });

  it('refuses what isn’t a zip', () => {
    expect(refusedAs(new TextEncoder().encode('Just some words.'))).toBe('not-epub');
    expect(refusedAs(new Uint8Array(0))).toBe('not-epub');
  });

  it('checks the CRC of what it reads', async () => {
    const bytes = handZip([{ name: 'a.xhtml', data: 'Words that change.' }]);
    bytes[30 + 'a.xhtml'.length] = (bytes[30 + 'a.xhtml'.length] as number) ^ 1; // the first byte of the data
    expect(await archive(bytes).read('a.xhtml', 100)).toMatchObject({ refused: 'damaged' });
  });

  it('refuses an entry that inflates to less than it declares', async () => {
    const zip = archive(handZip([{ name: 'a', data: 'short', method: 8, declared: 50 }]));
    expect(await zip.read('a', 100)).toMatchObject({ refused: 'damaged' });
  });

  it('refuses a stream that isn’t deflate', async () => {
    const zip = archive(
      handZip([
        { name: 'a', data: 'words', method: 8, packed: new Uint8Array([0xff, 0xff, 0xff]) },
      ]),
    );
    expect(await zip.read('a', 100)).toMatchObject({ refused: 'damaged' });
  });

  it('refuses a name it doesn’t hold', async () => {
    expect(await archive(handZip([{ name: 'a', data: 'x' }])).read('b', 100)).toMatchObject({
      refused: 'damaged',
    });
  });

  it('never throws, even when the inflater does', async () => {
    const zip = archive(handZip([{ name: 'a', data: 'words', method: 8 }]), undefined, () => {
      throw new Error('no inflater here');
    });
    expect(await zip.read('a', 100)).toMatchObject({ refused: 'damaged' });
  });
});

describe('openZip: the caps', () => {
  it('refuses a file past the file cap before reading it', () => {
    expect(refusedAs(handZip([{ name: 'a', data: 'x'.repeat(200) }]), small({ file: 100 }))).toBe(
      'too-large',
    );
  });

  it('refuses more entries than the cap', () => {
    const entries = Array.from({ length: 4 }, (_, n) => ({ name: `${n}`, data: 'x' }));
    expect(refusedAs(handZip(entries), small({ entries: 3 }))).toBe('too-large');
    expect(refusedAs(handZip(entries), small({ entries: 4 }))).toBe('opened');
  });

  it('refuses an entry that would inflate past the ratio, before inflating it', () => {
    const count = 1 + 258 * 1000;
    const inflate = vi.fn(inflateRaw);
    const bytes = handZip([
      { name: 'bomb', data: new Uint8Array(count), method: 8, packed: zerosDeflate(count) },
    ]);
    expect(isRefusal(openZip(bytes, inflate))).toBe(true);
    expect(openZip(bytes, inflate)).toMatchObject({ refused: 'too-large' });
    expect(inflate).not.toHaveBeenCalled();
    // Under the size the ratio starts from, a small file packs as it likes.
    expect(refusedAs(bytes, small({ ratioFrom: count }))).toBe('opened');
  });

  it('refuses entries that together pass the total, before inflating any', () => {
    const entries = Array.from({ length: 3 }, (_, n) => ({ name: `${n}`, data: 'x'.repeat(40) }));
    expect(refusedAs(handZip(entries), small({ total: 100 }))).toBe('too-large');
    expect(refusedAs(handZip(entries), small({ total: 120 }))).toBe('opened');
  });

  it('refuses to read an entry past the cap it’s read under', async () => {
    const zip = archive(handZip([{ name: 'a', data: 'x'.repeat(50), method: 8 }]));
    expect(await zip.read('a', 49)).toMatchObject({ refused: 'too-large' });
    expect(await zip.read('a', 50)).toBeInstanceOf(Uint8Array);
  });

  it('stops inflating at the declared size when the header lies', async () => {
    const count = 1 + 258 * 254;
    const { inflate, calls } = counted(inflateRaw);
    const zip = archive(
      handZip([
        {
          name: 'a',
          data: new Uint8Array(count),
          method: 8,
          packed: zerosDeflate(count),
          declared: 1024,
        },
      ]),
      undefined,
      inflate,
    );
    expect(await zip.read('a', 1024)).toMatchObject({ refused: 'damaged' });
    // It stopped at the first chunk past the declared size, never the whole 64 KiB.
    expect(calls).toHaveLength(1);
    expect((calls[0]?.total ?? 0) - (calls[0]?.last ?? 0)).toBeLessThanOrEqual(1024);
    expect(calls[0]?.total).toBeLessThan(count);
  });
});

describe('openZip: names', () => {
  it.each([
    '../../outside.txt',
    '/etc/passwd',
    'OEBPS/../../up.xhtml',
    'C:/Windows/win.ini',
    'OEBPS\\chapter.xhtml',
    'OEBPS//chapter.xhtml',
    'OEBPS/./chapter.xhtml',
    'name\u0000.xhtml',
  ])('refuses a book with an entry named %j', (name) => {
    expect(refusedAs(handZip([{ name, data: 'x' }]))).toBe('unsafe');
  });

  it('refuses two entries of one name, the same written two ways included', () => {
    expect(
      refusedAs(
        handZip([
          { name: 'a', data: 'x' },
          { name: 'a', data: 'y' },
        ]),
      ),
    ).toBe('unsafe');
    expect(
      refusedAs(
        handZip([
          { name: 'Caf\u00e9', data: 'x' },
          { name: 'Cafe\u0301', data: 'y' },
        ]),
      ),
    ).toBe('unsafe');
  });
});

describe('openZip: what it can’t read', () => {
  it('refuses an encrypted entry as locked', () => {
    const bytes = handZip([{ name: 'a', data: 'x' }]);
    const central = bytes.length - 22 - 46 - 1;
    bytes[central + 8] = (bytes[central + 8] as number) | 1; // the central header's encrypted bit
    expect(refusedAs(bytes)).toBe('locked');
  });

  it('refuses a compression other than stored or deflate', () => {
    const bytes = handZip([{ name: 'a', data: 'x' }]);
    bytes[bytes.length - 22 - 46 - 1 + 10] = 12; // bzip2
    expect(refusedAs(bytes)).toBe('unsupported');
  });

  it('refuses Zip64 and an archive split across disks', () => {
    const bytes = handZip([{ name: 'a', data: 'x' }]);
    const locator = new Uint8Array(20);
    new DataView(locator.buffer).setUint32(0, 0x0706_4b50, true);
    const end = bytes.slice(-22);
    expect(refusedAs(new Uint8Array([...bytes.slice(0, -22), ...locator, ...end]))).toBe(
      'unsupported',
    );
    const split = bytes.slice();
    split[split.length - 22 + 4] = 1;
    expect(refusedAs(split)).toBe('unsupported');
  });

  it('refuses a directory that points outside the file', () => {
    const bytes = handZip([{ name: 'a', data: 'x' }]);
    new DataView(bytes.buffer).setUint32(bytes.length - 22 + 16, 0x7fff_ffff, true);
    expect(refusedAs(bytes)).toBe('damaged');
  });

  it('refuses an entry whose data runs into the directory', () => {
    const bytes = handZip([{ name: 'a', data: 'x' }]);
    new DataView(bytes.buffer).setUint32(bytes.length - 22 - 46 - 1 + 20, 5000, true);
    expect(refusedAs(bytes)).toBe('damaged');
  });

  it('reads stored deflate blocks longer than one block holds', async () => {
    const data = new Uint8Array(70_000).map((_, i) => i % 251);
    expect(storedDeflate(data).length).toBeGreaterThan(data.length);
    const zip = archive(handZip([{ name: 'a', data, method: 8 }]));
    expect(await zip.read('a', 80_000)).toEqual(data);
  });
});

describe('openZip: names written two ways', () => {
  it('finds an entry by the name’s composed form, as a Mac’s zip may decompose it', async () => {
    const zip = archive(handZip([{ name: 'Café.xhtml', data: 'words' }]));
    expect(zip.has('Café.xhtml')).toBe(true);
    expect(text(await zip.read('Café.xhtml', 100))).toBe('words');
  });
});

describe('openZip: the end record and names', () => {
  it('takes the end record whose comment ends the file, not a signature in the comment', () => {
    const bytes = handZip([{ name: 'a', data: 'x' }]);
    // A comment holding an end record's signature (and a fake record after it).
    const fake = new Uint8Array(25);
    new DataView(fake.buffer).setUint32(0, 0x0605_4b50, true);
    const withComment = new Uint8Array([...bytes.slice(0, -2), fake.length, 0, ...fake]);
    expect(archive(withComment).entries.map((entry) => entry.name)).toEqual(['a']);
  });

  it('reads a name written as UTF-8 without the flag that says so, else as Latin-1', () => {
    const named = (raw: number[]) => {
      const bytes = handZip([{ name: 'x'.repeat(raw.length), data: 'x' }]);
      const central = 30 + raw.length + 1;
      bytes[central + 9] = 0; // no UTF-8 flag (0x0800, the flags' high byte)
      bytes.set(raw, 30);
      bytes.set(raw, central + 46);
      return archive(bytes).entries[0]?.name;
    };
    expect(named([0x43, 0x61, 0x66, 0xc3, 0xa9])).toBe('Café');
    expect(named([0x43, 0x61, 0x66, 0xe9])).toBe('Café');
  });

  it('says a system that can’t inflate is unsupported, not the book damaged', async () => {
    const zip = archive(handZip([{ name: 'a', data: 'words', method: 8 }]), undefined, () => {
      throw Object.assign(new Error('no raw deflate'), { name: 'NotSupportedError' });
    });
    expect(await zip.read('a', 100)).toMatchObject({ refused: 'unsupported' });
  });
});
