import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { GIF, JPEG, png } from '../../../tests/support/images';
import { base64, dataAddress, imageInfo } from './images';

describe('imageInfo', () => {
  it('reads PNG, GIF and JPEG from their own headers', () => {
    expect(imageInfo(png(300, 200))).toEqual({ kind: 'png', width: 300, height: 200 });
    expect(imageInfo(GIF)).toEqual({ kind: 'gif', width: 1, height: 1 });
    expect(imageInfo(JPEG)).toEqual({ kind: 'jpeg', width: 1, height: 1 });
  });

  it('finds a JPEG’s size past its other segments, in a progressive frame too', () => {
    // SOI, an APP1 of 4 bytes, a fill byte, then SOF2 (progressive): 8 bits, 480 high, 640 wide.
    const bytes = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x04, 0xaa, 0xbb, 0xff, 0xff, 0xc2, 0x00, 0x11, 0x08, 0x01,
      0xe0, 0x02, 0x80, 0x03,
    ]);
    expect(imageInfo(bytes)).toEqual({ kind: 'jpeg', width: 640, height: 480 });
  });

  it('is null for anything else: WebP, SVG, text, a cut header, a size of nothing', () => {
    const text = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
    expect(imageInfo(text('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '))).toBeNull();
    expect(imageInfo(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(imageInfo(new Uint8Array())).toBeNull();
    expect(imageInfo(png(3, 2).subarray(0, 20))).toBeNull();
    expect(imageInfo(png(0, 2))).toBeNull();
    expect(imageInfo(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]))).toBeNull(); // a JPEG with no frame
  });

  it('never throws, whatever the bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), (bytes) => {
        const info = imageInfo(Uint8Array.from([0xff, 0xd8, 0xff, ...bytes]));
        if (info) expect(info.width * info.height).toBeGreaterThan(0);
      }),
    );
  });
});

describe('base64', () => {
  it('is btoa’s', () => {
    expect([base64(new Uint8Array()), base64(Uint8Array.from([77]))]).toEqual(['', 'TQ==']);
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 50 }), (bytes) => {
        expect(base64(bytes)).toBe(btoa(String.fromCharCode(...bytes)));
      }),
    );
  });

  it('makes a data address of the kind', () => {
    expect(dataAddress('gif', GIF)).toMatch(/^data:image\/gif;base64,R0lGODlh/u);
  });
});
