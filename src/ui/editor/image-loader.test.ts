import { afterEach, describe, expect, it, vi } from 'vitest';
import { noteImages } from './image-loader';

describe('noteImages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const bytes = new Uint8Array([137, 80, 78, 71]);

  it('reads an image beside the note, once, as a blob URL', async () => {
    const readBytes = vi.fn(async () => bytes);
    const images = noteImages('Fic/Scarf', readBytes);
    const url = await images.load('cover.png');
    expect(url).toMatch(/^blob:/);
    expect(await images.load('./cover.png')).toBe(url); // the same file: read once
    expect(readBytes).toHaveBeenCalledTimes(1);
    expect(readBytes).toHaveBeenCalledWith('Fic/Scarf/cover.png');
  });

  it('reads from the vault root, and climbs folders within the vault', async () => {
    const readBytes = vi.fn(async () => bytes);
    const images = noteImages('Fic/Scarf', readBytes);
    await images.load('/attachments/a.jpg');
    await images.load('../art/b.webp');
    expect(readBytes.mock.calls).toEqual([['attachments/a.jpg'], ['Fic/art/b.webp']]);
  });

  it('never reads outside the vault, from the web, or a file that isn’t an image', async () => {
    const readBytes = vi.fn(async () => bytes);
    const images = noteImages('Fic', readBytes);
    for (const src of [
      '../../outside.png',
      'https://example.com/a.png',
      'notes.md',
      'archive.zip',
      'noextension',
    ]) {
      expect(await images.load(src)).toBeNull();
    }
    expect(readBytes).not.toHaveBeenCalled();
  });

  it('gives nothing for a missing image or a failed read', async () => {
    const images = noteImages('', async (path) => {
      if (path === 'gone.png') return null;
      throw new Error('unreadable');
    });
    expect(await images.load('gone.png')).toBeNull();
    expect(await images.load('broken.png')).toBeNull();
  });

  it('lets go of its URLs when the note closes', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const images = noteImages('', async () => bytes);
    const url = await images.load('a.png');
    images.release();
    await Promise.resolve();
    await Promise.resolve();
    expect(revoke).toHaveBeenCalledWith(url);
  });
});
