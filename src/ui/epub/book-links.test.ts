// A book's own links and notes on its page (#40, Phase 2b): a link goes to
// its chapter and place with one step back, a note's reference shows the note
// over the page, a hostile book's links stay words and its ids never become
// the window's, and a copy gives the words alone.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { closeMenu } from '../menu/menu';
import { nameLinks, noteIn } from './book-links';
import { copyWords, markupOf, plainText, wordsIn } from './book-words';
import { ChapterSheet } from './chapter-sheet';
import type { EpubPage } from './epub-page';
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
    const shown = vi.spyOn(ChapterSheet.prototype, 'showPlace');
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
    const shown = vi.spyOn(ChapterSheet.prototype, 'showPlace');
    press(note()?.querySelector('button'));
    expect(note()).toBeNull();
    await vi.waitFor(() => expect(shown).toHaveBeenCalled());
    expect(shown.mock.lastCall?.[0]).toBeGreaterThan(0);
    expect(backButton(side.page).hidden).toBe(false);
  });
});

describe('a note over the page, again', () => {
  it('opens again on the same reference after it closed by Esc', async () => {
    const { side } = sideWith(book('links.epub'));
    await side.open('a.epub');
    const mark = side.page.chapter.querySelector<HTMLAnchorElement>('sup a[href]');
    press(mark);
    await vi.waitFor(() => expect(note()).not.toBeNull());
    note()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(note()).toBeNull();
    press(mark);
    await vi.waitFor(() => expect(note()).not.toBeNull());
  });

  it('catches its own links: the window never follows one, the book does', async () => {
    const { side } = sideWith(book('links.epub'));
    await side.open('a.epub');
    press(side.page.chapter.querySelector('sup a[href]'));
    await vi.waitFor(() => expect(note()).not.toBeNull());
    // The note's own way back to its reference, "1.".
    const back = note()?.querySelector('a[href]');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    back?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(note()).toBeNull();
    expect(location.hash).toBe('');
  });

  it('is one note: the block of words a marker heads or stands before, never the chapter', () => {
    const chapter = document.createElement('div');
    chapter.innerHTML =
      '<a data-anchor="fn1"></a><p>The first note.</p><div><a data-anchor="fn2"></a><p>The second.</p><p>Not it.</p></div><p><a data-anchor="fn3"></a>The third.</p><div data-part="note"><a data-anchor="fn4"></a><p>Four,</p><p>in two.</p></div>';
    expect(noteIn(chapter, 'fn1')?.textContent).toBe('The first note.');
    expect(noteIn(chapter, 'fn2')?.textContent).toBe('The second.');
    expect(noteIn(chapter, 'fn3')?.textContent).toBe('The third.');
    expect(noteIn(chapter, 'fn4')?.textContent).toBe('Four,in two.');
    expect(noteIn(chapter, 'missing')).toBeNull();
  });

  it('isn’t a numeral link out of a sup: an index’s page goes there', async () => {
    const { side } = sideWith(book('links.epub'));
    await side.open('a.epub');
    const index = document.createElement('a');
    index.setAttribute('href', '#book/OEBPS%2Ftext%2Fchapter-3.xhtml:sir-william');
    index.textContent = '45';
    side.page.chapter.append(index);
    press(index);
    await vi.waitFor(() => expect(side.spine).toBe(2));
    expect(note()).toBeNull();
  });
});

describe('Back', () => {
  it('isn’t brought back by a link still drawing when the reader chooses a chapter', async () => {
    const { side } = sideWith(book('links.epub'));
    await side.open('a.epub');
    press(
      [...side.page.chapter.querySelectorAll('a')].find((a) => a.textContent === 'see Chapter III'),
    );
    await side.go(1);
    await new Promise((done) => setTimeout(done, 20));
    expect(side.spine).toBe(1);
    expect(backButton(side.page).hidden).toBe(true);
  });

  it('isn’t taken from a field: Alt+← is a word left there', async () => {
    const { side } = sideWith(book('links.epub'));
    await side.open('a.epub');
    press(
      [...side.page.chapter.querySelectorAll('a')].find((a) => a.textContent === 'see Chapter III'),
    );
    await vi.waitFor(() => expect(backButton(side.page).hidden).toBe(false));
    const field = document.body.appendChild(document.createElement('textarea'));
    const key = new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, cancelable: true });
    field.addEventListener('keydown', (event) => side.page.key(event));
    field.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    expect(side.spine).toBe(2);
  });
});

describe('a hostile book’s links', () => {
  it('keep their words alone, name none of the window’s elements, and a mark to nowhere goes nowhere', async () => {
    const shown = vi.spyOn(ChapterSheet.prototype, 'showPlace');
    const { side } = sideWith(book('links-hostile.epub'));
    await side.open('a.epub');
    const chapter = side.page.chapter;
    expect(chapter.textContent).toContain('way 0');
    // Only the book's own, and the web's for the browser; every other way stays words.
    expect([...chapter.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))).toEqual([
      expect.stringMatching(/^#book\//u),
      expect.stringMatching(/^#book\//u),
      'https://example.com/',
      expect.stringMatching(/^#book\//u),
    ]);
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

describe('a link’s name in the tooltip, and the web’s', () => {
  it('names a chapter, a place the contents name, a note, and the web’s address', async () => {
    const { side } = sideWith(book('links.epub'));
    await side.open('a.epub');
    const chapter = side.page.chapter;
    const tip = (words: string) =>
      [...chapter.querySelectorAll<HTMLElement>('a[href]')].find((a) => a.textContent === words)
        ?.dataset.tip;
    expect(tip('see Chapter III')).toBe('Chapter III');
    expect(tip('1')).toBe('Note 1');
    const web = document.createElement('a');
    web.href = 'https://www.gutenberg.org/ebooks/1342';
    web.textContent = 'Gutenberg';
    const mail = document.createElement('a');
    mail.href = 'mailto:jane@example.com';
    mail.textContent = 'Jane';
    chapter.append(web, mail);
    nameLinks(chapter, side.epub as never);
    expect(tip('Gutenberg')).toBe('www.gutenberg.org/ebooks/1342');
    expect(tip('Jane')).toBe('jane@example.com');
    // A place the contents name, beside its chapter's.
    const epub = side.epub as NonNullable<typeof side.epub>;
    const place = document.createElement('a');
    place.setAttribute('href', '#book/OEBPS%2Ftext%2Fendnotes.xhtml:n1');
    place.textContent = 'the note';
    chapter.append(place);
    nameLinks(chapter, {
      ...epub,
      contents: [
        ...epub.contents,
        { ...epub.contents[3], title: 'The first note', fragment: 'n1' } as never,
      ],
    });
    expect(tip('the note')).toBe('Notes · The first note');
  });

  it('opens a web or mail link in the system’s browser, as a note’s does, the window never going there', async () => {
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { side } = sideWith(book('links-hostile.epub'));
    await side.open('a.epub');
    const web = side.page.chapter.querySelector('a[href="https://example.com/"]');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    web?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(opened).toHaveBeenCalledExactlyOnceWith('https://example.com/');
  });
});

describe('the words copied, as EPUB 2 books mark notes', () => {
  it('leave a mark in a sup behind, and keep a line break', async () => {
    const { side } = sideWith(book('links.epub'));
    await side.open('a.epub');
    const first = side.page.chapter.querySelector('p');
    first?.append(document.createElement('br'), 'A second line.');
    const range = document.createRange();
    range.selectNodeContents(first as Node);
    const plain = plainText(wordsIn(range));
    expect(plain).toMatch(/wife\.\nA second line\.$/u);
    expect(plain).not.toMatch(/wife\.1/u);
  });

  it('are the chapter’s alone, however far the selection reaches past it', async () => {
    const { side } = sideWith(book('notes.epub'));
    await side.open('a.epub');
    const stop = copyWords(side.page.chapter);
    const range = document.createRange();
    range.setStartBefore(side.page.element);
    range.setEndAfter(side.page.element);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    const data = new Map<string, string>();
    const event = new Event('copy', { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', {
      value: { setData: (type: string, value: string) => data.set(type, value) },
    });
    document.dispatchEvent(event);
    stop();
    expect(event.defaultPrevented).toBe(true);
    expect(data.get('text/plain')).toMatch(/^Chapter I\.?\n\nIt is a truth/u);
    expect(data.get('text/html')).not.toMatch(/href|data-|blob:/u);
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
