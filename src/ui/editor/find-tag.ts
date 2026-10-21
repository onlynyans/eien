// Where a tag typed in the text is (docs/design/explorations/tags.md: a tag
// in the words shows on the page's head with a dot, and choosing it shows
// where it is). The first place it's a tag, as the index reads tags: not in
// code, a link, an address or HTML, and not in the front matter.

import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import { inlineTagsAt, tagKey } from '../../core/tags';
import { frontMatterEnd } from '../../core/text';

/** Where a "#" is no tag (core/markdown blanks the same for the index). */
const NOT_TAGS = new Set([
  'InlineCode',
  'FencedCode',
  'CodeBlock',
  'Link',
  'Image',
  'URL',
  'Autolink',
  'WikiLink',
  'HTMLTag',
  'HTMLBlock',
  'CommentBlock',
]);

/** Where the tag `key` (core/tags' tagKey) is first written in the words; null if nowhere. */
export function findTag(state: EditorState, key: string): { from: number; to: number } | null {
  const text = state.doc.toString();
  const start = frontMatterEnd(text);
  // Parsed to the end: a tag far down a long note is still found.
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state);
  for (const found of inlineTagsAt(text.slice(start))) {
    if (tagKey(found.tag) !== key) continue;
    const from = start + found.from;
    let inside = false;
    for (let node: SyntaxNode | null = tree.resolveInner(from + 1, 1); node; node = node.parent) {
      if (NOT_TAGS.has(node.name)) inside = true;
    }
    if (!inside) return { from, to: start + found.to };
  }
  return null;
}
