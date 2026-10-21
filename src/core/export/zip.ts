// A zip archive, stored without compression: what EPUB and Word files are.
// Store-only is all either needs (an EPUB's "mimetype" must be stored), and a
// book's words are small, so Eien writes the format itself rather than
// carry a package for it (docs/dependencies.md).

export interface ZipEntry {
  /** The path inside the archive, "/" separated. */
  readonly path: string;
  /** Text is written as UTF-8. */
  readonly data: string | Uint8Array;
}

/** The most a stored zip without its 64-bit extension can hold: sizes and offsets are 32 bits. */
const MAX_BYTES = 0xffff_ffff;
/** And entries are counted in 16 bits. */
const MAX_ENTRIES = 0xffff;

/** `text` as UTF-8, a lone surrogate as U+FFFD (as TextEncoder, which core can't reach). */
export function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (const char of text.toWellFormed()) {
    const code = char.codePointAt(0) as number;
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000)
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
  }
  return Uint8Array.from(out);
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb8_8320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** The CRC-32 a zip keeps for each file (the ISO 3309 one, as zlib computes it). */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffff_ffff) >>> 0;
}

/** `date` (local time) as MS-DOS keeps it: [time, date], to two seconds, from 1980 on. */
export function dosTime(date: Date): [number, number] {
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 1980) return [0, (1 << 5) | 1];
  const year = Math.min(date.getFullYear(), 2107) - 1980;
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  return [time, (year << 9) | ((date.getMonth() + 1) << 5) | date.getDate()];
}

/** The archive holding `entries` in their order, each dated `date`. */
export function zipStore(entries: readonly ZipEntry[], date: Date): Uint8Array {
  if (entries.length > MAX_ENTRIES) throw new RangeError('Too many files for one archive.');
  const [time, day] = dosTime(date);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.path)) throw new Error(`Two files at ${entry.path}.`);
    seen.add(entry.path);
    const name = utf8(entry.path);
    const data = typeof entry.data === 'string' ? utf8(entry.data) : entry.data;
    if (offset + data.length + 30 + name.length > MAX_BYTES) {
      throw new RangeError('Too much for one archive.');
    }
    // Bit 11 says the name is UTF-8; left off for plain ASCII, as an EPUB's mimetype wants.
    const flags = /^[\x20-\x7e]*$/u.test(entry.path) ? 0 : 0x0800;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x0403_4b50, true);
    local.setUint16(4, 10, true); // version needed: 1.0, stored
    local.setUint16(6, flags, true);
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true); // no extra field
    parts.push(new Uint8Array(local.buffer), name, data);

    const head = new DataView(new ArrayBuffer(46));
    head.setUint32(0, 0x0201_4b50, true);
    head.setUint16(4, 20, true); // made by: 2.0
    head.setUint16(6, 10, true);
    head.setUint16(8, flags, true);
    head.setUint16(10, 0, true);
    head.setUint16(12, time, true);
    head.setUint16(14, day, true);
    head.setUint32(16, crc, true);
    head.setUint32(20, data.length, true);
    head.setUint32(24, data.length, true);
    head.setUint16(28, name.length, true);
    // Extra field, comment, disk, internal and external attributes: all 0.
    head.setUint32(42, offset, true);
    central.push(new Uint8Array(head.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  if (offset + centralSize + 22 > MAX_BYTES) throw new RangeError('Too much for one archive.');
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x0605_4b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
