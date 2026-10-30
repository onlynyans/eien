// Quote (#40, Phase 2c): the words chosen in a book, as a Markdown quote with
// the book's title and chapter under them, handed to the note beside; Q on
// the page does it; nothing chosen, or no note, is said in the colophon.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { sideWith } from './test-side';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);

/** The page's words from the first that starts with `from`, through `count` paragraphs, chosen. */
function choose(chapter: HTMLElement, from: string, count = 1): void {
  const paragraphs = [...chapter.querySelectorAll('p')];
  const first = paragraphs.findIndex((p) => p.textContent?.startsWith(from));
  const range = document.createRange();
  range.setStartBefore(paragraphs[first] as Node);
  range.setEndAfter(paragraphs[first + count - 1] as Node);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}

async function opened(
  name: string,
  quote = vi.fn(async (_text: string, _from: unknown) => ({ into: 'At the Assembly' }) as const),
) {
  const made = sideWith({ 'a.epub': EPUBS[name] as Uint8Array });
  (made.of as { quote?: unknown }).quote = quote;
  await made.side.open('a.epub');
  return { ...made, quote };
}

const said = (side: Awaited<ReturnType<typeof opened>>['side']) => side.page.foot.said.textContent;

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('Quote', () => {
  it('hands the note beside the words chosen as a quote, the book and chapter under them', async () => {
    const { side, quote } = await opened('plain.epub');
    choose(side.page.chapter, 'Mr. Bennet replied', 2);
    await side.quote();
    expect(quote).toHaveBeenCalledExactlyOnceWith(
      '> Mr. Bennet replied that he had not.\n>\n> “But it is,” returned she.\n>\n> — Pride and Prejudice, Chapter I',
      side,
    );
    expect(said(side)).toBe('Quoted in At the Assembly.');
  });

  it('keeps the words alone: no note’s mark, no link’s address', async () => {
    const { side, quote } = await opened('links.epub');
    choose(side.page.chapter, 'It is a truth');
    await side.quote();
    const text = quote.mock.calls[0]?.[0] as string;
    expect(text).toMatch(/^> It is a truth universally acknowledged, .* wife\.\n>\n> — /u);
    expect(text).not.toMatch(/wife\.1|<sup>|#book|\]\(/u);
  });

  it('is pressed with Q on the page, while words are chosen there', async () => {
    const { side, quote } = await opened('plain.epub');
    const q = () => new KeyboardEvent('keydown', { key: 'q', cancelable: true });
    const none = q();
    side.page.key(none);
    expect(none.defaultPrevented).toBe(false); // nothing chosen: Q is the page's to ignore
    choose(side.page.chapter, 'Mr. Bennet replied');
    const pressed = q();
    side.page.key(pressed);
    expect(pressed.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(quote).toHaveBeenCalledTimes(1));
    side.page.key(new KeyboardEvent('keydown', { key: 'q', metaKey: true }));
    expect(quote).toHaveBeenCalledTimes(1);
  });

  it('says why when nothing’s chosen, or there’s no note to quote into', async () => {
    const quote = vi.fn(
      async (_text: string, _from: unknown) =>
        ({ not: 'Open a note beside the book to quote into it.' }) as const,
    );
    const { side } = await opened('plain.epub', quote as never);
    await side.quote();
    expect(said(side)).toBe('Choose some words in the book to quote.');
    expect(quote).not.toHaveBeenCalled();
    choose(side.page.chapter, 'Mr. Bennet replied');
    await side.quote();
    expect(said(side)).toBe('Open a note beside the book to quote into it.');
  });

  it('quotes the words last chosen in the chapter after a tap elsewhere dropped them (a phone’s ⋯)', async () => {
    const { side, quote } = await opened('plain.epub');
    choose(side.page.chapter, 'Mr. Bennet replied');
    document.dispatchEvent(new Event('selectionchange'));
    document.getSelection()?.removeAllRanges();
    await side.quote(true);
    expect(quote.mock.calls[0]?.[0]).toMatch(/^> Mr\. Bennet replied that he had not\./u);
  });

  it('quotes only what’s chosen now with Q: nothing once the choice is gone, once while it’s held, and the choice let go after', async () => {
    const { side, quote } = await opened('plain.epub');
    choose(side.page.chapter, 'Mr. Bennet replied');
    document.dispatchEvent(new Event('selectionchange'));
    document.getSelection()?.removeAllRanges();
    const q = (repeat = false) => {
      const key = new KeyboardEvent('keydown', { key: 'q', repeat, cancelable: true });
      side.page.key(key);
      return key;
    };
    expect(q().defaultPrevented).toBe(false); // the words chosen before are gone: nothing
    expect(quote).not.toHaveBeenCalled();
    choose(side.page.chapter, 'Mr. Bennet replied');
    q();
    expect(q(true).defaultPrevented).toBe(true); // held: taken, but quoted once
    await vi.waitFor(() => expect(quote).toHaveBeenCalledTimes(1));
    // Quoted, the choice goes: a second press quotes nothing again.
    expect(document.getSelection()?.isCollapsed ?? true).toBe(true);
  });

  it('counts the part of a choice that runs past the chapter', async () => {
    const { side, quote } = await opened('plain.epub');
    const paragraphs = [...side.page.chapter.querySelectorAll('p')];
    const range = document.createRange();
    range.setStartBefore(paragraphs.at(-1) as Node);
    range.setEndAfter(side.page.element.querySelector('.sheet__turns') as Node);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    await side.quote();
    expect(quote.mock.calls[0]?.[0]).toMatch(/^> .+\n>\n> — Pride and Prejudice, Chapter I$/su);
    expect(quote.mock.calls[0]?.[0]).not.toMatch(/Chapter II\n/u);
  });
});
