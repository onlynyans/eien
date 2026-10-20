// Eien's two additions to Markdown (spec §4): ==highlight== and [[wiki
// links]] between notes. One definition, used by the editor and by the
// index that reads notes for tags, previews and search.

import { tags } from '@lezer/highlight';
import type { DelimiterType, MarkdownConfig } from '@lezer/markdown';

const EQUALS = 61;
const OPEN_BRACKET = 91;
const PUNCTUATION = /[\p{S}\p{P}]/u;

const HighlightDelimiter: DelimiterType = { resolve: 'Highlight', mark: 'HighlightMark' };

/** ==highlight==, following the rules GitHub's ~~strikethrough~~ uses. */
export const Highlight: MarkdownConfig = {
  defineNodes: [
    { name: 'Highlight', style: { 'Highlight/...': tags.special(tags.content) } },
    { name: 'HighlightMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'Highlight',
      parse(cx, next, pos) {
        // Exactly two: "===" is not a highlight mark, from either end.
        if (next !== EQUALS || cx.char(pos + 1) !== EQUALS) return -1;
        if (cx.char(pos + 2) === EQUALS || cx.char(pos - 1) === EQUALS) return -1;
        const before = cx.slice(pos - 1, pos);
        const after = cx.slice(pos + 2, pos + 3);
        const spaceBefore = /\s|^$/.test(before);
        const spaceAfter = /\s|^$/.test(after);
        const punctBefore = PUNCTUATION.test(before);
        const punctAfter = PUNCTUATION.test(after);
        return cx.addDelimiter(
          HighlightDelimiter,
          pos,
          pos + 2,
          !spaceAfter && (!punctAfter || spaceBefore || punctBefore),
          !spaceBefore && (!punctBefore || spaceAfter || punctAfter),
        );
      },
      after: 'Emphasis',
    },
  ],
};

/** [[Note title]]: a link to another note, by its title, on one line. */
export const WikiLink: MarkdownConfig = {
  defineNodes: [
    { name: 'WikiLink', style: tags.link },
    { name: 'WikiLinkMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'WikiLink',
      parse(cx, next, pos) {
        if (next !== OPEN_BRACKET || cx.char(pos + 1) !== OPEN_BRACKET) return -1;
        const rest = cx.slice(pos + 2, cx.end);
        const close = rest.indexOf(']]');
        const title = close === -1 ? '' : rest.slice(0, close);
        if (!title.trim() || title.includes('\n') || title.includes('[')) return -1;
        const end = pos + 2 + close + 2;
        return cx.addElement(
          cx.elt('WikiLink', pos, end, [
            cx.elt('WikiLinkMark', pos, pos + 2),
            cx.elt('WikiLinkMark', end - 2, end),
          ]),
        );
      },
      before: 'Link',
    },
  ],
};
