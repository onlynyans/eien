// Raw deflate inflated by the system's own DecompressionStream (#40): a
// book's zip entries (core/epub/zip-read.ts), in the window on the desktop and
// on the phone alike, with no package for it. The stored bytes go in a slice
// at a time, only as the inflated side is read: Chromium inflates a whole
// chunk it's given before it answers, so one chunk of a lying entry could
// otherwise make gigabytes. The reader counts what comes out and stops past
// the entry's declared size, and stopping cancels the stream.

import type { Inflate } from '../core/epub';

/** How much stored deflate goes in at once: at most about 4 MB out (deflate's ratio is 1032 to 1). */
export const SLICE = 4096;

/** `raw` as a stream that gives one slice each time it's asked, and none before. */
export function slices(raw: Uint8Array): ReadableStream<Uint8Array<ArrayBuffer>> {
  let at = 0;
  return new ReadableStream<Uint8Array<ArrayBuffer>>(
    {
      pull(controller) {
        if (at >= raw.length) return controller.close();
        controller.enqueue(raw.slice(at, at + SLICE));
        at += SLICE;
      },
    },
    { highWaterMark: 0 },
  );
}

/** What's thrown where the system can't inflate (an Android WebView older than Chrome 103). */
export const NOT_SUPPORTED = 'NotSupportedError';

/** What `source` (raw deflate) inflates to, a chunk at a time; stopping cancels it. */
export async function* inflated(
  source: ReadableStream<Uint8Array<ArrayBuffer>>,
): AsyncGenerator<Uint8Array> {
  let decompress: DecompressionStream;
  try {
    decompress = new DecompressionStream('deflate-raw');
  } catch {
    throw Object.assign(new Error('This system has no raw deflate.'), { name: NOT_SUPPORTED });
  }
  const reader = source.pipeThrough(decompress).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    // Stopped early (past the declared size) or done: what's left is never inflated.
    await reader.cancel().catch(() => {});
  }
}

export const inflateRaw: Inflate = (raw) => inflated(slices(raw));
