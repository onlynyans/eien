import { afterEach, describe, expect, it, vi } from 'vitest';
import { hyphenates } from './hyphens';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('whether the window hyphenates a language (Phase 3d)', () => {
  it('asks once a language: a long word breaks in a narrow box, or runs out of it', () => {
    const tall = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(60);
    expect(hyphenates('en-GB')).toBe(true);
    tall.mockReturnValue(20);
    expect(hyphenates('ja')).toBe(false);
    // Asked again, the answer kept: no box laid out.
    expect(hyphenates('en-GB')).toBe(true);
    expect(tall).toHaveBeenCalledTimes(2);
    expect(document.body.children).toHaveLength(0);
  });

  it('never for a book that names no language: no dictionary to break its words by', () => {
    const tall = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(60);
    expect(hyphenates('')).toBe(false);
    expect(tall).not.toHaveBeenCalled();
  });
});
