// The one file the window may write as bytes: an image a note shows. A
// window that's been made to ask for anything else is refused, whatever it asks.

import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES } from '../core/vault';
import { imageWrite } from './image-write';

describe('writing bytes from the window', () => {
  it('takes an image a note shows', () => {
    const bytes = new Uint8Array([1, 2]);
    for (const path of ['A.assets/x.png', 'A.assets/x.JPG', 'b.webp', 'c.gif', 'd.svg', 'e.avif'])
      expect(imageWrite(path, bytes)).toEqual([path, bytes]);
  });

  it('refuses anything else: a note, a hidden file, a script, text for bytes', () => {
    const bytes = new Uint8Array([1]);
    for (const path of ['Note.md', '.eien/config.json', 'A.assets/.png', 'x.html', 'x.js'])
      expect(() => imageWrite(path, bytes), path).toThrow(/Only an image/);
    expect(() => imageWrite('a.png', 'not bytes')).toThrow(TypeError);
    expect(() => imageWrite('a.png', [1, 2, 3])).toThrow(TypeError);
    expect(() => imageWrite(42 as unknown as string, bytes)).toThrow(TypeError);
  });

  it('refuses an image bigger than a note shows', () => {
    expect(() => imageWrite('a.png', new Uint8Array(MAX_IMAGE_BYTES + 1))).toThrow(/too big/);
  });
});
