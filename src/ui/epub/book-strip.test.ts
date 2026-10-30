// A book on its page's edge (#40, Phase 4d): its chapters and bookmarks on
// the strip, the place told as it moves, and a point on it opening the
// chapter there.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { laidOut } from './test-lines';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function opened() {
  const at = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
  laidOut(at.side.page);
  await at.side.open('a.epub');
  const strip = at.side.page.element.querySelector<HTMLElement>('.edge-strip') as HTMLElement;
  strip.getBoundingClientRect = () => ({ top: 0, height: 1000 }) as DOMRect;
  return { ...at, strip };
}

describe('a book on its page’s edge', () => {
  it('shows each of its chapters, and each bookmark once made', async () => {
    const { side, strip } = await opened();
    expect(strip.querySelectorAll('.edge-strip__chapter')).toHaveLength(
      new Set(side.epub?.contents.filter((row) => row.depth === 0).map((row) => row.spine)).size,
    );
    expect(strip.querySelectorAll('.edge-strip__mark')).toHaveLength(0);
    side.page.key(new KeyboardEvent('keydown', { key: 'b' }));
    await vi.waitFor(() => expect(strip.querySelectorAll('.edge-strip__mark')).toHaveLength(1));
  });

  it('says where the page is, by its chapter', async () => {
    const { strip } = await opened();
    expect(strip.getAttribute('aria-valuetext')).toMatch(/^Chapter I/u);
  });

  it('opens the chapter a point on it is in, and steps a chapter at a time by its keys', async () => {
    const { side, strip } = await opened();
    const at = (y: number, type: string) =>
      strip.dispatchEvent(new PointerEvent(type, { clientY: y, button: 0, bubbles: true }));
    at(999, 'pointerdown');
    at(999, 'pointerup');
    const last = side.epub?.spine.length ?? 0;
    await vi.waitFor(() => expect(side.spine).toBe(last - 1));
    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await vi.waitFor(() => expect(side.spine).toBe(side.epub?.contents[0]?.spine));
    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await vi.waitFor(() => expect(side.spine).toBe((side.epub?.contents[0]?.spine ?? 0) + 1));
  });
});
