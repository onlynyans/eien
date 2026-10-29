// A book's own links and notes on its page (#40, Phase 2b): a link goes to
// its chapter and place with one step back, a note's reference shows the note
// over the page, a hostile book's links stay words and its ids never become
// the window's, and a copy gives the words alone.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { closeMenu } from '../menu/menu';
import { markupOf, plainText, wordsIn } from './book-words';
import { EpubPage } from './epub-page';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);
const book = (name: string) => ({ 'a.epub': EPUBS[name] as Uint8Array });
const press = (element: Element | null | undefined) =>
  element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const note = () => document.querySelector<HTMLElement>('.epub-note');
const backButton = (page: EpubPage) => page.foot.figures[0] as HTMLButtonElement;

afterEach(() => {
  closeMenu();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('a book’s own link', () => {
  it('goes to its chapter and place, one step back in the colophon, ⌘[ and Alt+←', async () => {
    const shown = vi.spyOn(EpubPage.prototype, 'showPlace');
    const { side, writes } = sideWith(book('links.epub'));
    await side.open('a.epub');
    expect(side.spine).toBe(0);
    const link = [...side.page.chapter.querySelectorAll('a')].find(
      (a) => a.textContent === 'see Chapter III',
    );
    expect(link?.getAttribute('href')).toBe('#book/OEBPS%2Ftext%2Fchapter-3.xhtml:sir-william');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link?.dispatchEvent(event);
    // Never the window's: its address goes nowhere.
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(side.spine).toBe(2));
    // The place the span named: past the chapter's first paragraph.
    expect(shown.mock.lastCall?.[0]).toBeGreaterThan(0);
    expect(writes).toHaveBeenLastCalledWith(side.epub?.key, {
      chapter: 'OEBPS/text/chapter-3.xhtml',
      offset: shown.mock.lastCall?.[0],
    });
    expect(backButton(side.page).hidden).toBe(false);
    expect(backButton(side.page).textContent).toBe('Back to Chapter I');
    side.page.key(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(side.spine).toBe(0));
    expect(backButton(side.page).hidden).toBe(true);
    // No step back now: the key does nothing, and isn't taken.
    const again = new KeyboardEvent('keydown', { key: '[', metaKey: true, cancelable: true });
    side.page.key(again);
    expect(again.defaultPrevented).toBe(false);
  });

  it('is forgotten when the reader chooses a chapter', async () => {
    const { side } = sideWith(book('links.epub'));
    await side.open('a.epub');
    press(
      [...side.page.chapter.querySelectorAll('a')].find((a) => a.textContent === 'see Chapter III'),
    );
    await vi.waitFor(() => expect(side.spine).toBe(2));
    await side.go(1);
    expect(backButton(side.page).hidden).toBe(true);
  });
});

describe('a note’s reference', () => {
  it('shows the note over the page, from another chapter: Esc closes it, the keyboard back on the mark', async () => {
    const { side } = sideWith(book('links.epub'));
    await side.open('a.epub');
    const mark = side.page.chapter.querySelector<HTMLAnchorElement>('sup a[href]');
    mark?.focus();
    press(mark);
    await vi.waitFor(() => expect(note()).not.toBeNull());
    expect(side.spine).toBe(0); // still where it was read
    expect(note()?.getAttribute('role')).toBe('dialog');
    expect(note()?.getAttribute('aria-label')).toBe('Note 1');
    expect(note()?.textContent).toContain('The novel’s first sentence, and its most quoted.');
    expect(document.activeElement).toBe(note());
    note()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(note()).toBeNull();
    expect(document.activeElement).toBe(mark);
  });

  it('shows a note in the same chapter, as Eien’s own export writes it, and Go to the note goes there', async () => {
    const { side } = sideWith(book('notes.epub'));
    await side.open('a.epub');
    const marks = side.page.chapter.querySelectorAll<HTMLAnchorElement>('a[data-part="note-ref"]');
    expect(marks).toHaveLength(2);
    press(marks[1]);
    await vi.waitFor(() =>
      expect(note()?.textContent).toContain('Netherfield Park, let to Mr. Bingley.'),
    );
    // Pressed again, it closes.
    press(marks[1]);
    await vi.waitFor(() => expect(note()).toBeNull());
    press(marks[0]);
    await vi.waitFor(() => expect(note()).not.toBeNull());
    const shown = vi.spyOn(EpubPage.prototype, 'showPlace');
    press(note()?.querySelector('button'));
    expect(note()).toBeNull();
    await vi.waitFor(() => expect(shown).toHaveBeenCalled());
    expect(shown.mock.lastCall?.[0]).toBeGreaterThan(0);
    expect(backButton(side.page).hidden).toBe(false);
  });
});

describe('a hostile book’s links', () => {
  it('keep their words alone, name none of the window’s elements, and a mark to nowhere goes nowhere', async () => {
    const shown = vi.spyOn(EpubPage.prototype, 'showPlace');
    const { side } = sideWith(book('links-hostile.epub'));
    await side.open('a.epub');
    const chapter = side.page.chapter;
    expect(chapter.textContent).toContain('way 0');
    for (const a of chapter.querySelectorAll('a[href]')) {
      expect(a.getAttribute('href')).toMatch(/^#book\//u);
    }
    expect(chapter.querySelectorAll('[id], [name], [onclick], script')).toHaveLength(0);
    expect(document.getElementById('settings')).toBeNull();
    shown.mockClear();
    press(chapter.querySelector('a[href$=":nowhere"]'));
    await new Promise((done) => setTimeout(done));
    expect(note()).toBeNull();
    expect(shown).not.toHaveBeenCalled();
    // A note that would run: shown as words.
    press(chapter.querySelector('a[href$=":n-bad"]'));
    await vi.waitFor(() => expect(note()?.textContent).toContain('A note that runs nothing.'));
    expect(note()?.querySelectorAll('[onclick], script')).toHaveLength(0);
  });
});

describe('the words copied', () => {
  it('leave the page behind: no address, no note’s mark, no marker, no attribute', async () => {
    const { side } = sideWith(book('notes.epub'));
    await side.open('a.epub');
    const range = document.createRange();
    range.selectNodeContents(side.page.chapter);
    const words = wordsIn(range);
    expect(words.querySelectorAll('a, [data-part], [data-anchor], img, [href]')).toHaveLength(0);
    const plain = plainText(words);
    expect(plain).toContain('It is a truth universally acknowledged');
    expect(plain).toContain('\n\n');
    expect(plain).not.toMatch(/wife\.\d/u);
    expect(markupOf(words)).not.toMatch(/href|data-|blob:/u);
  });
});
