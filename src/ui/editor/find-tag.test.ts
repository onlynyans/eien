// A tag in the words, found where the writer typed it.

import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { findTag } from './find-tag';
import { eienMarkdown } from './syntax';

const at = (doc: string, key: string) => {
  const found = findTag(EditorState.create({ doc, extensions: [eienMarkdown()] }), key);
  return found && doc.slice(found.from, found.to);
};

describe('a tag in the words', () => {
  it('is found where it is first a tag, case aside', () => {
    const doc = 'One `#draft` in code, [#draft](x) a link, then #Draft here.';
    const found = findTag(EditorState.create({ doc, extensions: [eienMarkdown()] }), 'draft');
    expect(found && doc.slice(found.from, found.to)).toBe('#Draft');
    expect(found?.from).toBe(doc.indexOf('#Draft'));
  });

  it('is not front matter, nor a tag only in code', () => {
    expect(at('---\ntags: [x]\nnote: "#draft"\n---\nNo tag.', 'draft')).toBeNull();
    expect(at('```\n#draft\n```\n', 'draft')).toBeNull();
    expect(at('Nested #fic/aot too.', 'fic/aot')).toBe('#fic/aot');
  });
});
