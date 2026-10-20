// Adversarial: the vault index (phase 6a) runs in the main process, so how
// long it takes to read a note is how long every save, read and list waits.
// The 8 MB cap (MAX_NOTE_BYTES) bounds a note's size, not the time it takes:
// the Markdown parser is quadratic in a paragraph's brackets.

import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../memory/memory-storage';
import { MAX_NOTE_BYTES, VaultIndex } from './index';

describe('VaultIndex, adversarial', () => {
  it('reads a long interview transcript, well under the size cap, in reasonable time', async () => {
    // A pasted transcript: one line per turn, no blank lines (one paragraph), stage
    // directions in brackets. 1.3 MB, a sixth of the cap.
    const transcript = 'ANNA: I told him [laughs] that it was fine. [pause]\n'.repeat(26_000);
    expect(transcript.length).toBeLessThan(MAX_NOTE_BYTES / 6);
    const storage = new MemoryStorage();
    storage.put('Interview.md', transcript);
    const index = new VaultIndex(storage);
    const started = performance.now();
    await index.refresh(); // and again after every save of it: the write waits for this
    const took = performance.now() - started;
    expect(index.notes()[0]?.words).toBeGreaterThan(0);
    // The same text in paragraphs reads in ~0.2 s; the e2e budget for a typed change is 5 s.
    expect(took).toBeLessThan(1000);
  }, 120_000);
});
