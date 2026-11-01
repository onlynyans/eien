import { describe, expect, it } from 'vitest';
import { zerosDeflate } from '../../tests/support/epub-zip';
import { inflateRaw, SLICE, slices } from './inflate';

describe('inflateRaw', () => {
  // Chromium inflates a whole chunk it's given before it answers: slices keep a lying entry's
  // output to about 4 MB a step (measured in Chromium; Node's own stream paces itself).
  it('gives the stored bytes a slice at a time, and only as it’s asked', async () => {
    const raw = new Uint8Array(SLICE * 3 + 5).map((_, i) => i % 256);
    const reader = slices(raw).getReader();
    const sizes: number[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      sizes.push(value.length);
    }
    expect(sizes).toEqual([SLICE, SLICE, SLICE, 5]);
  });

  it('inflates what deflate made, to the byte', async () => {
    const out: number[] = [];
    for await (const chunk of inflateRaw(zerosDeflate(1 + 258 * 10))) out.push(...chunk);
    expect(out).toEqual(Array(1 + 258 * 10).fill(0));
  });
});
