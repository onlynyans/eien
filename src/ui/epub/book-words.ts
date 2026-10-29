// The words of a selection in a book (#40, Phase 2b), as they go anywhere
// else: copied, or quoted into a note (Phase 2c). What the page drew for the
// book's sake stays behind: a link keeps its words without its address (an
// address of this page's own means nothing elsewhere), a note's reference
// goes, as do a place's marker, a picture (the window's own copy) and every
// attribute. Its shapes stay: paragraphs, italics, a quote.

/** The blocks between which a plain copy puts a blank line. */
const BLOCK = /^(?:P|DIV|LI|DD|DT|BLOCKQUOTE|H[1-6]|FIGURE|FIGCAPTION|PRE|TR)$/u;

/** `range`'s words and their shapes, with nothing of the page's own. */
export function wordsIn(range: Range): DocumentFragment {
  const words = range.cloneContents();
  for (const element of [...words.querySelectorAll('*')]) {
    if (element.matches('[data-part="note-ref"], a[data-anchor], img, .image-words')) {
      element.remove();
      continue;
    }
    for (const name of element.getAttributeNames()) element.removeAttribute(name);
    if (element.localName === 'a') element.replaceWith(...element.childNodes);
  }
  return words;
}

/** `words` as plain text: a blank line between blocks, spaces run together within them. */
export function plainText(words: DocumentFragment): string {
  const blocks: string[] = [];
  let line = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) line += node.textContent ?? '';
    const block = node instanceof Element && BLOCK.test(node.tagName);
    if (block) end();
    for (const child of node.childNodes) walk(child);
    if (block) end();
  };
  const end = () => {
    const words = line.replace(/\s+/gu, ' ').trim();
    if (words) blocks.push(words);
    line = '';
  };
  walk(words);
  end();
  return blocks.join('\n\n');
}

/** As markup, for a page that pastes it (a note's paste reads it as Markdown). */
export function markupOf(words: DocumentFragment): string {
  const holder = document.createElement('div');
  holder.append(words.cloneNode(true));
  return holder.innerHTML;
}

/** A copy from `root` gives these words, not what the page drew. */
export function copyWords(root: HTMLElement): void {
  root.addEventListener('copy', (event) => {
    const selection = document.getSelection();
    if (!event.clipboardData || !selection || selection.rangeCount === 0 || selection.isCollapsed)
      return;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    const words = wordsIn(range);
    event.preventDefault();
    event.clipboardData.setData('text/plain', plainText(words));
    event.clipboardData.setData('text/html', markupOf(words));
  });
}
