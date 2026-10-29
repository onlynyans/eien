// A zip written by hand for the fixture books (#40, ./epub-fixtures.ts), where
// Eien's own writer (core/export/zip.ts) writes only what an export needs:
// deflated entries with data descriptors as other tools write them, and the
// hostile shapes a reader must refuse (a name out of the zip, a size that
// lies, a bomb). Its deflate makes stored blocks, and a run of zeros as one
// fixed-Huffman block of long matches: no compressor needed.

import type { Inflate } from '../../src/core/epub';
import { crc32, utf8 } from '../../src/core/export/zip';

export interface HandEntry {
  readonly name: string;
  readonly data: Uint8Array | string;
  /** Deflated (8), or stored (0, the default). */
  readonly method?: 0 | 8;
  /** Its bytes as stored, when not `data` packed by `method` (a bomb's). */
  readonly packed?: Uint8Array;
  /** The size the headers declare, when it's to lie. */
  readonly declared?: number;
  /** Sizes and CRC after the data, as streaming writers put them. */
  readonly descriptor?: boolean;
}

const bytesOf = (data: Uint8Array | string) => (typeof data === 'string' ? utf8(data) : data);

/** `data` as deflate's stored blocks: valid deflate, packed no smaller. */
export function storedDeflate(data: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(data.length / 0xffff));
  const out = new Uint8Array(data.length + 5 * blocks);
  for (let block = 0, at = 0; block < blocks; block++) {
    const from = block * 0xffff;
    const length = Math.min(0xffff, data.length - from);
    out.set(
      [
        block === blocks - 1 ? 1 : 0,
        length & 0xff,
        length >> 8,
        ~length & 0xff,
        (~length >> 8) & 0xff,
      ],
      at,
    );
    out.set(data.subarray(from, from + length), at + 5);
    at += 5 + length;
  }
  return out;
}

/** `count` zero bytes as deflate: a literal, then 258-byte matches; `count` is 1 + 258n. */
export function zerosDeflate(count: number): Uint8Array {
  const out: number[] = [];
  let bits = 0;
  let filled = 0;
  const put = (value: number, n: number) => {
    for (let i = 0; i < n; i++) {
      bits |= ((value >> i) & 1) << filled;
      if (++filled === 8) {
        out.push(bits);
        bits = 0;
        filled = 0;
      }
    }
  };
  // A Huffman code goes in its bits from the top down.
  const code = (value: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) put((value >> i) & 1, 1);
  };
  put(1, 1); // the last block
  put(1, 2); // fixed Huffman codes
  code(0x30, 8); // a literal zero
  for (let made = 1; made + 258 <= count; made += 258) {
    code(0b1100_0101, 8); // length 258
    code(0, 5); // distance 1
  }
  code(0, 7); // end of block
  if (filled > 0) out.push(bits);
  return Uint8Array.from(out);
}

/** The archive of `entries`, in order, dated 1 January 1980. */
export function handZip(entries: readonly HandEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = utf8(entry.name);
    const data = bytesOf(entry.data);
    const method = entry.method ?? 0;
    const packed = entry.packed ?? (method === 8 ? storedDeflate(data) : data);
    const size = entry.declared ?? data.length;
    const crc = crc32(data);
    const flags = (entry.descriptor ? 0x0008 : 0) | 0x0800;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x0403_4b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, flags, true);
    local.setUint16(8, method, true);
    local.setUint16(12, 0x21, true); // 1980-01-01
    if (!entry.descriptor) {
      local.setUint32(14, crc, true);
      local.setUint32(18, packed.length, true);
      local.setUint32(22, size, true);
    }
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, packed);
    let length = 30 + name.length + packed.length;
    if (entry.descriptor) {
      const after = new DataView(new ArrayBuffer(16));
      after.setUint32(0, 0x0807_4b50, true);
      after.setUint32(4, crc, true);
      after.setUint32(8, packed.length, true);
      after.setUint32(12, size, true);
      parts.push(new Uint8Array(after.buffer));
      length += 16;
    }
    const head = new DataView(new ArrayBuffer(46));
    head.setUint32(0, 0x0201_4b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 20, true);
    head.setUint16(8, flags, true);
    head.setUint16(10, method, true);
    head.setUint16(14, 0x21, true);
    head.setUint32(16, crc, true);
    head.setUint32(20, packed.length, true);
    head.setUint32(24, size, true);
    head.setUint16(28, name.length, true);
    head.setUint32(42, offset, true);
    central.push(new Uint8Array(head.buffer), name);
    offset += length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
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

/** What one call of an inflater gave: its bytes in all, and its last chunk's. */
export interface InflateCall {
  total: number;
  last: number;
}

/** `inflate`, each call's output counted: a test sees where the reader stopped it. */
export function counted(inflate: Inflate): { inflate: Inflate; calls: InflateCall[] } {
  const calls: InflateCall[] = [];
  return {
    calls,
    inflate: async function* (raw) {
      const call = { total: 0, last: 0 };
      calls.push(call);
      for await (const chunk of inflate(raw)) {
        call.total += chunk.length;
        call.last = chunk.length;
        yield chunk;
      }
    },
  };
}
