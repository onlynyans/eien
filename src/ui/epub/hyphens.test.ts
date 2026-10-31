import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { handEpub, opf, XHTML, page as xhtml } from '../../../tests/support/epub-parts';
import { hyphenates } from './hyphens';
import { sideWith } from './test-side';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
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

// QA (#40, Phase 3d): the probe is the language's own, set to hyphenate in a
// box narrower than the word, so its height says whether the window breaks
// it; each language (a region too) asked of its own.
describe('the hyphenation probe', () => {
  it('lays the word out in the language asked of, hyphenating, in a box narrower than it', () => {
    const seen: { lang: string; hyphens: string; width: string; text: string | null }[] = [];
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      seen.push({
        lang: this.lang,
        hyphens: this.style.hyphens,
        width: this.style.width,
        text: this.textContent,
      });
      return this.isConnected ? 40 : 0;
    });
    expect(hyphenates('de-CH')).toBe(true);
    expect(hyphenates('de')).toBe(true);
    expect(seen).toEqual([
      { lang: 'de-CH', hyphens: 'auto', width: '4em', text: 'incomprehensibilities' },
      { lang: 'de', hyphens: 'auto', width: '4em', text: 'incomprehensibilities' },
    ]);
  });
});

// QA (#40, Phase 3d): a book's page wears whether its language hyphenates
// here (its leaf's data-hyphens, which Set as a book justifies by), and a
// book that names no language never does.
describe('a book’s page and its language’s hyphens', () => {
  it('justifies a book whose words break here, and not the next that names no language', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(60);
    const bare = handEpub('content.opf', [
      {
        name: 'content.opf',
        data: opf('3.0', [{ id: 'c1', href: 'one.xhtml', type: XHTML }], ['c1']).replace(
          '<dc:language>en</dc:language>',
          '',
        ),
      },
      { name: 'one.xhtml', data: xhtml('One', '<p>Words with no language.</p>') },
    ]);
    const { side } = sideWith({
      'a.epub': fixtureEpubs(SAMPLE_SOURCES)['plain.epub'] as Uint8Array,
      'b.epub': bare,
    });
    await side.open('a.epub');
    expect(side.page.chapter.lang).toBe('en');
    expect(side.page.element.hasAttribute('data-hyphens')).toBe(true);
    await side.open('b.epub');
    expect(side.page.chapter.textContent).toContain('Words with no language.');
    expect(side.page.element.hasAttribute('data-hyphens')).toBe(false);
    side.dispose();
  });
});
