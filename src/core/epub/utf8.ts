// UTF-8 read back into text, as TextDecoder would (which core can't reach):
// a byte that doesn't belong is U+FFFD, a leading byte-order mark is dropped.
// A book's files are UTF-8 (EPUB 3 §3.1); its names are too, when the zip
// says so.

const REPLACEMENT = 0xfffd;
/** Code units turned into a string at a time: fromCharCode takes its arguments on the stack. */
const CHUNK = 8192;

/** The text `bytes` hold as UTF-8; `from` to `to`, the part to read. */
export function fromUtf8(bytes: Uint8Array, from = 0, to = bytes.length): string {
  const units: number[] = [];
  const parts: string[] = [];
  let at = from;
  if (to - at >= 3 && bytes[at] === 0xef && bytes[at + 1] === 0xbb && bytes[at + 2] === 0xbf) {
    at += 3;
  }
  while (at < to) {
    const first = bytes[at] as number;
    let code = REPLACEMENT;
    let size = 1;
    if (first < 0x80) code = first;
    else {
      // WHATWG's decoder: how many bytes follow, and the range the next may be in (no overlong
      // form, no surrogate, nothing past U+10FFFF).
      const [follow, low, high] =
        first >= 0xc2 && first <= 0xdf
          ? [1, 0x80, 0xbf]
          : first === 0xe0
            ? [2, 0xa0, 0xbf]
            : first === 0xed
              ? [2, 0x80, 0x9f]
              : first >= 0xe1 && first <= 0xef
                ? [2, 0x80, 0xbf]
                : first === 0xf0
                  ? [3, 0x90, 0xbf]
                  : first === 0xf4
                    ? [3, 0x80, 0x8f]
                    : first >= 0xf1 && first <= 0xf3
                      ? [3, 0x80, 0xbf]
                      : [0, 0, 0];
      let value = first & (0x3f >> follow);
      let read = 0;
      for (let lower = low, upper = high; read < follow; lower = 0x80, upper = 0xbf) {
        const next = bytes[at + 1 + read];
        if (at + 1 + read >= to || next === undefined || next < lower || next > upper) break;
        value = (value << 6) | (next & 0x3f);
        read++;
      }
      // A broken sequence is one replacement, and reading goes on at the byte that broke it.
      if (follow > 0 && read === follow) code = value;
      size = 1 + read;
    }
    at += size;
    if (code > 0xffff) {
      code -= 0x10000;
      units.push(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else units.push(code);
    if (units.length >= CHUNK) {
      parts.push(String.fromCharCode(...units));
      units.length = 0;
    }
  }
  parts.push(String.fromCharCode(...units));
  return parts.join('');
}

/** `bytes` as Latin-1: a zip's name without its UTF-8 flag (close enough to IBM 437 for the names a book uses). */
export function fromLatin1(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let at = 0; at < bytes.length; at += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(at, at + CHUNK)));
  }
  return parts.join('');
}
