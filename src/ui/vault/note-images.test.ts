// Images dropped or pasted into a note: copied into its own folder, never
// over an image already there, and linked relative to the note.

import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES } from '../../core/vault';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { pastedImages } from '../editor/image-drop';
import { copyImages } from './note-images';

/** A file as the window gets one from a drop or a paste. */
const fileOf = (
  name: string,
  type: string,
  bytes = new Uint8Array([1, 2, 3]),
  size = bytes.length,
) => ({ name, type, size, arrayBuffer: async () => bytes.slice().buffer }) as unknown as File;

async function setUp() {
  const storage = new MemoryStorage();
  storage.put('Fic/Chapter 3.md', 'Words.');
  const told: string[] = [];
  const vault = { writeNew: (path: string, bytes: Uint8Array) => storage.writeNew(path, bytes) };
  const copy = (files: File[]) =>
    copyImages(vault, 'Fic/Chapter 3.md', files, (message) => told.push(message));
  return { storage, told, copy };
}

describe('copying images into a note', () => {
  it('keeps each in the note’s own folder, linked relative to the note', async () => {
    const { storage, copy } = await setUp();
    const shown = await copy([fileOf('Scarf.PNG', 'image/png'), fileOf('', 'image/jpeg')]);
    expect(shown).toBe('![](Chapter%203.assets/Scarf.png)\n![](Chapter%203.assets/image.jpg)');
    expect(await storage.readBytes('Fic/Chapter 3.assets/Scarf.png')).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(await storage.readBytes('Fic/Chapter 3.assets/image.jpg')).not.toBeNull();
  });

  it('numbers a name that’s taken, and never writes over the image there', async () => {
    const { storage, copy } = await setUp();
    await storage.writeNew('Fic/Chapter 3.assets/image.png', new Uint8Array([9]));
    const shown = await copy([fileOf('image.png', 'image/png'), fileOf('image.png', 'image/png')]);
    expect(shown).toBe(
      '![](Chapter%203.assets/image%202.png)\n![](Chapter%203.assets/image%203.png)',
    );
    expect(await storage.readBytes('Fic/Chapter 3.assets/image.png')).toEqual(new Uint8Array([9]));
  });

  it('says why it left out what isn’t an image a note shows, or is too big', async () => {
    const { storage, told, copy } = await setUp();
    const shown = await copy([
      fileOf('notes.pdf', 'application/pdf'),
      fileOf('huge.png', 'image/png', new Uint8Array([1]), MAX_IMAGE_BYTES + 1),
      fileOf('ok.gif', 'image/gif'),
    ]);
    expect(shown).toBe('![](Chapter%203.assets/ok.gif)');
    expect(told).toEqual([
      expect.stringContaining('“notes.pdf” isn’t an image'),
      expect.stringContaining('“huge.png” is bigger than 32 MB'),
    ]);
    expect(await storage.readBytes('Fic/Chapter 3.assets/huge.png')).toBeNull();
  });

  it('says so when the image can’t be written, and links nothing', async () => {
    const told: string[] = [];
    const vault = {
      writeNew: async () => {
        throw new Error('ENOSPC: no space left on device');
      },
    };
    const shown = await copyImages(vault, 'A.md', [fileOf('a.png', 'image/png')], (m) =>
      told.push(m),
    );
    expect(shown).toBe('');
    expect(told[0]).toMatch(/“a.png” couldn’t be added: .*no space/);
  });
});

describe('what a paste brings', () => {
  const clipboard = (text: string, files: File[]) =>
    ({
      getData: (kind: string) => (kind === 'text/plain' ? text : ''),
      files,
    }) as unknown as DataTransfer;

  it('is its images, when it brings no words', () => {
    const shot = fileOf('image.png', 'image/png');
    expect(pastedImages(clipboard('', [shot]))).toEqual([shot]);
  });

  it('is its words, when it brings them too (a word processor’s picture of them beside)', () => {
    expect(pastedImages(clipboard('Chapter one', [fileOf('image.png', 'image/png')]))).toEqual([]);
    expect(pastedImages(clipboard('', [fileOf('a.txt', 'text/plain')]))).toEqual([]);
    expect(pastedImages(null)).toEqual([]);
  });
});
