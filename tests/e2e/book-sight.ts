// Where a book's words stand, as its page shows them (#40): what the end-to-end
// and the phone's page tests read off the window, by the app's own rules, so a
// test reads the line the app keeps and not one beside it.

import type { Locator } from '@playwright/test';

/**
 * Whether `words` begin in the pages in sight of `box` (a book's `.epub__pages`),
 * wherever on them: their first character's own box (its range's last, as a
 * character after a hyphenation point holds the hyphen too, on the line
 * before). A page turned away is laid out beside the one in sight, only clipped.
 */
export const wordsInSight = (box: Locator, words: string): Promise<boolean> =>
  box.evaluate((element, wanted) => {
    const sight = element.getBoundingClientRect();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = (node.textContent ?? '').indexOf(wanted);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + 1);
      const rect = [...range.getClientRects()].at(-1);
      return (
        rect !== undefined &&
        rect.left >= sight.left - 1 &&
        rect.right <= sight.right + 1 &&
        rect.top >= sight.top - 1 &&
        rect.bottom <= sight.bottom + 1
      );
    }
    return false;
  }, words);

/**
 * The words a book's place begins with while `scroller` (its page in Scroll)
 * stands where it is: from the first letter whose line ends below its top,
 * as the app measures the place (src/ui/epub/chapter-place.ts firstInSight).
 */
export const placeWords = (scroller: Locator, length = 24): Promise<string> =>
  scroller.evaluate((element, length) => {
    const top = element.getBoundingClientRect().top;
    const chapter = element.querySelector('.epub-chapter');
    if (!chapter) return '';
    const below = (node: Node, from: number, to: number) => {
      const range = document.createRange();
      range.setStart(node, from);
      range.setEnd(node, to);
      return [...range.getClientRects()].some((rect) => rect.bottom > top);
    };
    const walker = document.createTreeWalker(chapter, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? '';
      if (text.trim() === '' || !below(node, 0, text.length)) continue;
      for (let i = 0; i < text.length; i++) {
        // From its first letter: a space at a line's edge stands on either line.
        if (text[i]?.trim() && below(node, i, i + 1)) return text.slice(i, i + length);
      }
    }
    return '';
  }, length);
