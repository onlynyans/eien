// Images a book carries (spec §8): what kind a file's bytes are and how many
// pixels it is, read from its own header (never trusted from its name), and
// its bytes as base64 for a page that holds them. PNG, JPEG and GIF: what
// EPUB readers, Word and a PDF all show.

export type ImageKind = 'png' | 'jpeg' | 'gif';

export interface ImageInfo {
  readonly kind: ImageKind;
  readonly width: number;
  readonly height: number;
}

/** Each kind's media type and file extension. */
export const IMAGE_KINDS: Readonly<Record<ImageKind, { type: string; extension: string }>> = {
  png: { type: 'image/png', extension: 'png' },
  jpeg: { type: 'image/jpeg', extension: 'jpg' },
  gif: { type: 'image/gif', extension: 'gif' },
};

/** The most bytes all of an export's images may be together (one may be core/vault's MAX_IMAGE_BYTES). */
export const MAX_EXPORT_IMAGE_BYTES = 48 * 1024 * 1024;

const at = (bytes: Uint8Array, i: number) => bytes[i] ?? 0;
const big16 = (bytes: Uint8Array, i: number) => (at(bytes, i) << 8) | at(bytes, i + 1);
const big32 = (bytes: Uint8Array, i: number) => big16(bytes, i) * 65536 + big16(bytes, i + 2);
const little16 = (bytes: Uint8Array, i: number) => at(bytes, i) | (at(bytes, i + 1) << 8);
const starts = (bytes: Uint8Array, head: readonly number[]) => head.every((b, i) => bytes[i] === b);

/** JPEG's frame headers (SOF0–SOF15 but DHT, JPG and DAC), where the size is. */
const FRAMES = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegSize(bytes: Uint8Array): [number, number] | null {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (at(bytes, i) !== 0xff) return null;
    const marker = at(bytes, i + 1);
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2; // no length
      continue;
    }
    if (FRAMES.has(marker)) return [big16(bytes, i + 7), big16(bytes, i + 5)];
    if (marker === 0xd9 || marker === 0xda) return null; // the end, or the scan: no frame before it
    i += 2 + big16(bytes, i + 2);
  }
  return null;
}

/** What `bytes` are, as their header says; null for anything else, or a size of nothing. */
export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  let found: [ImageKind, number, number] | null = null;
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && bytes.length >= 24) {
    found = ['png', big32(bytes, 16), big32(bytes, 20)];
  } else if (
    starts(bytes, [0x47, 0x49, 0x46, 0x38]) &&
    (at(bytes, 4) === 0x37 || at(bytes, 4) === 0x39) &&
    at(bytes, 5) === 0x61 &&
    bytes.length >= 10
  ) {
    found = ['gif', little16(bytes, 6), little16(bytes, 8)];
  } else if (starts(bytes, [0xff, 0xd8, 0xff])) {
    const size = jpegSize(bytes);
    if (size) found = ['jpeg', size[0], size[1]];
  }
  if (!found || found[1] < 1 || found[2] < 1) return null;
  return { kind: found[0], width: found[1], height: found[2] };
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** `bytes` as base64 (core has no btoa). */
export function base64(bytes: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (at(bytes, i) << 16) | (at(bytes, i + 1) << 8) | at(bytes, i + 2);
    const left = bytes.length - i;
    out.push(
      (BASE64[(n >> 18) & 63] as string) +
        (BASE64[(n >> 12) & 63] as string) +
        (left > 1 ? (BASE64[(n >> 6) & 63] as string) : '=') +
        (left > 2 ? (BASE64[n & 63] as string) : '='),
    );
  }
  return out.join('');
}

/** A data address for `bytes` of `kind`, for the PDF's page. */
export const dataAddress = (kind: ImageKind, bytes: Uint8Array): string =>
  `data:${IMAGE_KINDS[kind].type};base64,${base64(bytes)}`;
