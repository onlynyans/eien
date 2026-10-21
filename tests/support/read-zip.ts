// A strict reader for the zips Eien writes (src/core/export/zip.ts), for
// tests: every header is checked against the central directory, each file's
// CRC (the writer's own CRC is held to zlib's in tests/zip-interop.test.ts),
// and the parts must follow one another with nothing between. What a lenient
// reader (Word, a book reader) would forgive fails. No Node: core's tests
// run it as the window would.

import { crc32 } from '../../src/core/export/zip';

export interface ReadZip {
  /** The paths, in the order the archive holds them. */
  readonly names: string[];
  readonly files: Map<string, Uint8Array>;
  /** Each file's general-purpose flags, by path. */
  readonly flags: Map<string, number>;
  text(path: string): string;
}

const decoder = new TextDecoder('utf-8', { fatal: true });

export function readZip(zip: Uint8Array): ReadZip {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const fail = (why: string): never => {
    throw new Error(`Not a sound zip: ${why}`);
  };
  const end = zip.length - 22;
  if (end < 0 || view.getUint32(end, true) !== 0x0605_4b50) fail('no end record');
  const count = view.getUint16(end + 10, true);
  if (view.getUint16(end + 8, true) !== count) fail('entry counts differ');
  const centralSize = view.getUint32(end + 12, true);
  const centralAt = view.getUint32(end + 16, true);
  if (centralAt + centralSize !== end)
    fail('the central directory does not end where the end record starts');

  const names: string[] = [];
  const files = new Map<string, Uint8Array>();
  const flags = new Map<string, number>();
  let at = centralAt;
  let expectedLocal = 0;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x0201_4b50) fail(`entry ${i} has no central header`);
    const flag = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    if (view.getUint32(at + 24, true) !== size) fail('a stored file whose sizes differ');
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const nameBytes = zip.subarray(at + 46, at + 46 + nameLength);
    const name = decoder.decode(nameBytes);
    if (method !== 0) fail(`${name} is compressed`);
    if (local !== expectedLocal) fail(`${name} is not where the last file ended`);
    if (view.getUint32(local, true) !== 0x0403_4b50) fail(`${name} has no local header`);
    if (view.getUint16(local + 6, true) !== flag) fail(`${name}'s flags differ`);
    if (view.getUint16(local + 8, true) !== 0) fail(`${name}'s method differs`);
    if (view.getUint32(local + 14, true) !== crc) fail(`${name}'s CRC differs`);
    if (view.getUint32(local + 18, true) !== size || view.getUint32(local + 22, true) !== size)
      fail(`${name}'s sizes differ`);
    if (view.getUint16(local + 26, true) !== nameLength) fail(`${name}'s name differs`);
    const localExtra = view.getUint16(local + 28, true);
    const nameAgain = zip.subarray(local + 30, local + 30 + nameLength);
    if (nameBytes.some((byte, i) => byte !== nameAgain[i])) fail(`${name}'s name differs`);
    const start = local + 30 + nameLength + localExtra;
    const data = zip.subarray(start, start + size);
    if (crc32(data) !== crc) fail(`${name}'s CRC is wrong`);
    if (files.has(name)) fail(`${name} is there twice`);
    names.push(name);
    files.set(name, data);
    flags.set(name, flag);
    expectedLocal = start + size;
    at += 46 + nameLength + extra;
  }
  if (expectedLocal !== centralAt) fail('something lies between the files and the directory');
  return {
    names,
    files,
    flags,
    text(path) {
      const data = files.get(path);
      if (!data) throw new Error(`No ${path} in the zip.`);
      return decoder.decode(data);
    },
  };
}
