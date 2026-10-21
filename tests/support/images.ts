// Real images for tests, made here with no package: a PNG of any size and
// colour (its pixels in stored deflate blocks, valid to every reader), and
// one-pixel GIF and JPEG files. No Node: core's tests use them too.

import { crc32 } from '../../src/core/export/zip';

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

/** A 1×1 GIF89a. */
export const GIF = fromBase64('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==');

/** A 1×1 baseline JPEG (JFIF, SOF0). */
export const JPEG = fromBase64(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=',
);

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** A zlib stream of `data` in stored (uncompressed) blocks. */
function stored(data: Uint8Array): Uint8Array {
  const blocks: number[] = [0x78, 0x01];
  for (let at = 0; at < data.length || at === 0; at += 0xffff) {
    const part = data.subarray(at, at + 0xffff);
    const last = at + 0xffff >= data.length ? 1 : 0;
    blocks.push(
      last,
      part.length & 0xff,
      part.length >> 8,
      ~part.length & 0xff,
      (~part.length >> 8) & 0xff,
    );
    for (const byte of part) blocks.push(byte);
    if (data.length === 0) break;
  }
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  blocks.push((b >> 8) & 0xff, b & 0xff, (a >> 8) & 0xff, a & 0xff);
  return Uint8Array.from(blocks);
}

/** A `width`×`height` PNG of one colour (red, green, blue). */
export function png(width: number, height: number, [r, g, b] = [200, 60, 40]): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB, deflate, no filter method, no interlace
  const row = 1 + width * 3;
  const pixels = new Uint8Array(row * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) pixels.set([r, g, b], y * row + 1 + x * 3);
  }
  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', stored(pixels)),
    chunk('IEND', new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
