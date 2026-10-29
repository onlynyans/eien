// A book's zip read (#40): Eien's own reader, the same on the desktop and the
// phone. The directory is read and checked whole before anything is
// inflated: every name a clean path inside the zip, none twice, every range
// inside the file, every declared size within the caps (./caps.ts), alone,
// together and by ratio. An entry is then read on its own, through the
// window's inflater (the browser's DecompressionStream), counted as it
// comes: past its declared size it stops, so a header that lies can't
// inflate more than it declared. Its CRC is checked last. Nothing here
// throws: a zip from anywhere ends in an archive or a refusal.

import { crc32 } from '../export/zip';
import { EPUB_CAPS, type EpubCaps } from './caps';
import { type Refusal, refuse } from './refusal';
import { fromLatin1, fromUtf8 } from './utf8';
import { isZipPath } from './zip-path';

/** Raw deflate (RFC 1951) inflated, in chunks as they come; stopping early cancels it. */
export type Inflate = (raw: Uint8Array) => AsyncIterable<Uint8Array>;

export interface ZipEntry {
  readonly name: string;
  /** 0 stored, 8 deflated. */
  readonly method: 0 | 8;
  /** Bytes as stored, and inflated, as the directory declares them. */
  readonly stored: number;
  readonly size: number;
  readonly crc: number;
  /** Where its local header starts. */
  readonly offset: number;
}

export interface ZipArchive {
  /** Every file's entry (a folder's own entry left out), in the directory's order. */
  readonly entries: readonly ZipEntry[];
  has(name: string): boolean;
  /** The entry `name`'s bytes, inflated and checked; refused past `cap` bytes. */
  read(name: string, cap: number): Promise<Uint8Array | Refusal>;
}

const END = 0x0605_4b50;
const CENTRAL = 0x0201_4b50;
const LOCAL = 0x0403_4b50;
const ZIP64_LOCATOR = 0x0706_4b50;
/** The end record's fixed part, and the most its comment can add. */
const END_SIZE = 22;
const MAX_COMMENT = 0xffff;

const ENCRYPTED = 0x0001;
const STRONG_ENCRYPTION = 0x0040;
const UTF8_NAME = 0x0800;

/**
 * Where the end record starts, searched back from the file's end; -1 for
 * none. One whose comment ends the file is the real one: a comment can hold
 * the signature too. Failing that, the last whose comment fits.
 */
function endRecord(view: DataView): number {
  const last = view.byteLength - END_SIZE;
  let fits = -1;
  for (let at = last; at >= 0 && at >= last - MAX_COMMENT; at--) {
    if (view.getUint32(at, true) !== END) continue;
    const end = at + END_SIZE + view.getUint16(at + 20, true);
    if (end === view.byteLength) return at;
    if (end < view.byteLength && fits < 0) fits = at;
  }
  return fits;
}

/** The directory of `bytes` read and checked, or why it won't be. */
function directory(bytes: Uint8Array, caps: EpubCaps): ZipEntry[] | Refusal {
  if (bytes.length > caps.file) return refuse('too-large', `the file is ${bytes.length} bytes`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = endRecord(view);
  if (end < 0) return refuse('not-epub', 'no end of central directory');
  if (end >= 20 && view.getUint32(end - 20, true) === ZIP64_LOCATOR) {
    return refuse('unsupported', 'Zip64');
  }
  const disk = view.getUint16(end + 4, true);
  const centralDisk = view.getUint16(end + 6, true);
  const onDisk = view.getUint16(end + 8, true);
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  const start = view.getUint32(end + 16, true);
  if (disk !== 0 || centralDisk !== 0 || onDisk !== count) {
    return refuse('unsupported', 'an archive split across disks');
  }
  if (count > caps.entries) return refuse('too-large', `${count} entries`);
  if (start + size > end) return refuse('damaged', 'the directory runs past its end');

  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  let total = 0;
  let at = start;
  for (let n = 0; n < count; n++) {
    if (at + 46 > start + size || view.getUint32(at, true) !== CENTRAL) {
      return refuse('damaged', `entry ${n} isn’t where the directory says`);
    }
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const stored = view.getUint32(at + 20, true);
    const inflated = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const skip = view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const nameEnd = at + 46 + nameLength;
    if (nameEnd + skip > start + size)
      return refuse('damaged', `entry ${n} runs past the directory`);
    const raw = bytes.subarray(at + 46, nameEnd);
    // Many tools write UTF-8 names without the flag that says so: UTF-8 whenever it reads as UTF-8.
    const utf8 = fromUtf8(raw);
    const name = flags & UTF8_NAME || !utf8.includes('\ufffd') ? utf8 : fromLatin1(raw);
    at = nameEnd + skip;
    if (!isZipPath(name)) return refuse('unsafe', `the name ${JSON.stringify(name)}`);
    const key = name.normalize('NFC');
    if (seen.has(key)) return refuse('unsafe', `two entries named ${JSON.stringify(name)}`);
    seen.add(key);
    if (name.endsWith('/')) continue; // a folder's own entry: nothing to read
    if (flags & (ENCRYPTED | STRONG_ENCRYPTION)) return refuse('locked', `${name} is encrypted`);
    if (method !== 0 && method !== 8)
      return refuse('unsupported', `${name}: compression ${method}`);
    if (method === 0 && stored !== inflated)
      return refuse('damaged', `${name}: stored sizes differ`);
    if (offset + 30 + stored > start) return refuse('damaged', `${name} runs into the directory`);
    if (inflated > caps.ratioFrom && inflated > stored * caps.ratio) {
      return refuse('too-large', `${name} inflates ${inflated} from ${stored}`);
    }
    total += inflated;
    if (total > caps.total) return refuse('too-large', `${total} bytes in all`);
    entries.push({ name, method, stored, size: inflated, crc, offset });
  }
  return entries;
}

/** The entry's stored bytes, from its own local header. */
function storedBytes(bytes: Uint8Array, entry: ZipEntry): Uint8Array | Refusal {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (entry.offset + 30 > bytes.length || view.getUint32(entry.offset, true) !== LOCAL) {
    return refuse('damaged', `${entry.name}: no local header`);
  }
  if (view.getUint16(entry.offset + 6, true) & (ENCRYPTED | STRONG_ENCRYPTION)) {
    return refuse('locked', `${entry.name} is encrypted`);
  }
  if (view.getUint16(entry.offset + 8, true) !== entry.method) {
    return refuse('damaged', `${entry.name}: its two headers disagree`);
  }
  const from =
    entry.offset +
    30 +
    view.getUint16(entry.offset + 26, true) +
    view.getUint16(entry.offset + 28, true);
  if (from + entry.stored > bytes.length)
    return refuse('damaged', `${entry.name} runs past the file`);
  return bytes.subarray(from, from + entry.stored);
}

/** `raw` inflated into exactly `size` bytes, or why not: never past `size`. */
async function inflated(
  raw: Uint8Array,
  size: number,
  inflate: Inflate,
  name: string,
): Promise<Uint8Array | Refusal> {
  const out = new Uint8Array(size);
  let length = 0;
  try {
    for await (const chunk of inflate(raw)) {
      if (length + chunk.length > size) {
        return refuse('damaged', `${name} inflates past its declared ${size} bytes`);
      }
      out.set(chunk, length);
      length += chunk.length;
    }
  } catch (error) {
    // The system can't inflate at all (platform/inflate.ts): not the book's fault.
    if (error instanceof Error && error.name === 'NotSupportedError') {
      return refuse('unsupported', `${name}: ${error.message}`);
    }
    return refuse('damaged', `${name} won’t inflate: ${String(error)}`);
  }
  return length === size
    ? out
    : refuse('damaged', `${name} inflates to ${length} of ${size} bytes`);
}

/** The zip `bytes` hold, its directory checked; its entries read by `inflate`. */
export function openZip(
  bytes: Uint8Array,
  inflate: Inflate,
  caps: EpubCaps = EPUB_CAPS,
): ZipArchive | Refusal {
  const entries = directory(bytes, caps);
  if (!Array.isArray(entries)) return entries;
  // By the name's NFC form: a zip made on a Mac may spell "é" as e and an accent, its hrefs not.
  const byName = new Map(entries.map((entry) => [entry.name.normalize('NFC'), entry]));
  return {
    entries,
    has: (name) => byName.has(name.normalize('NFC')),
    async read(name, cap) {
      const entry = byName.get(name.normalize('NFC'));
      if (!entry) return refuse('damaged', `no entry ${JSON.stringify(name)}`);
      if (entry.size > cap) return refuse('too-large', `${name} is ${entry.size} bytes`);
      const raw = storedBytes(bytes, entry);
      if (!(raw instanceof Uint8Array)) return raw;
      const data = entry.method === 0 ? raw : await inflated(raw, entry.size, inflate, name);
      if (!(data instanceof Uint8Array)) return data;
      return crc32(data) === entry.crc ? data : refuse('damaged', `${name}: its CRC doesn’t match`);
    },
  };
}
