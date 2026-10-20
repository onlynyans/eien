// Adversarial: phase 9c's outline cards, the part that needs no window — a
// card's first lines, made from the index's preview (the cards' styles are
// held to the design's rules in tests/e2e/adversarial-outline.spec.ts). A
// comment on a test describes the defect it caught, as it was before the fix.

import { describe, expect, it } from 'vitest';
import { PREVIEW_LENGTH, readNote } from '../../core/note';
import { summaryOf } from './board';

/** A card's first lines for a note with `text`, as the index and the board make them. */
const cardLines = (text: string) => summaryOf(readNote(text, 'Chapter').preview);

describe('a card’s first lines', () => {
  it('are marked as cut when the index cut the preview just before a space', () => {
    // The index cuts at 160 characters, then trims the end: when the 160th is a space the
    // preview is 159 long, and the board takes it for the whole chapter (no "…"). About one
    // English chapter in six ends its preview on a space.
    const text = `${'abcd '.repeat(40)}and the chapter goes on for pages.\n`;
    const preview = readNote(text, 'Chapter').preview;
    expect(preview.length).toBe(PREVIEW_LENGTH - 1); // cut by the index
    expect(text.trim().startsWith(preview)).toBe(true);
    expect(cardLines(text)).toMatch(/…$/u);
  });

  it('keep a whole short chapter whole, emoji and all', () => {
    // The index counts characters as the writer sees them (graphemes); the board counts
    // UTF-16 units. A short planning note with emoji reaches 160 units without being cut,
    // and its card drops its last words and says it goes on.
    const text = `Party scene ${'🎉 '.repeat(50)}and then the cake arrives.\n`;
    const preview = readNote(text, 'Chapter').preview;
    expect([...new Intl.Segmenter().segment(preview)].length).toBeLessThan(PREVIEW_LENGTH);
    expect(preview).toBe(text.trim()); // nothing cut
    expect(cardLines(text)).toBe(preview);
  });

  it('keep most of a preview in a language written without spaces', () => {
    // Japanese runs on without spaces; the only one may be where a heading line meets the
    // text. "Cut at a word" then cuts back to that space: the card shows the heading alone.
    const text = `第一章\n\n${'彼女は窓の外の雪を長いあいだ見ていた。'.repeat(12)}\n`;
    const preview = readNote(text, 'Chapter').preview;
    expect(preview.length).toBe(PREVIEW_LENGTH);
    expect(cardLines(text).length).toBeGreaterThan(PREVIEW_LENGTH / 2);
  });

  it('lose only a half word when the index cut one, in English', () => {
    const text = `${'The scarf caught on the gates. '.repeat(8)}She mended it slowly.\n`; // cut in "The s|carf"
    const summary = cardLines(text);
    const preview = readNote(text, 'Chapter').preview;
    expect(summary.endsWith('…')).toBe(true);
    expect(preview.startsWith(summary.slice(0, -1))).toBe(true);
    expect(preview.length - (summary.length - 1)).toBeLessThan(16);
  });

  it('are empty for an empty chapter, and the preview itself for a short one', () => {
    expect(cardLines('')).toBe('');
    expect(cardLines('# Chapter\n\nOnly this.\n')).toBe('Only this.');
  });
});
