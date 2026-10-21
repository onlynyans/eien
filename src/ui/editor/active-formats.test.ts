// The formatting bar shows what's on at the caret (backlog #14).

import { ensureSyntaxTree } from '@codemirror/language';
import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { activeFormats } from './active-formats';
import { eienMarkdown } from './syntax';

/** What's on with the caret at "|" in `marked`. */
function on(marked: string): string[] {
  const caret = marked.indexOf('|');
  const doc = marked.slice(0, caret) + marked.slice(caret + 1);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(caret),
    extensions: [eienMarkdown()],
  });
  ensureSyntaxTree(state, doc.length);
  return [...activeFormats(state)].sort();
}

describe('the formats on at the caret', () => {
  it('reads the words’ marks', () => {
    expect(on('a **bo|ld** word')).toEqual(['bold']);
    expect(on('a *soft|* word')).toEqual(['italic']);
    expect(on('***bo|th***')).toEqual(['bold', 'italic']);
    expect(on('~~gone|~~ and ==lit==')).toEqual(['strike']);
    expect(on('==l|it==')).toEqual(['highlight']);
    expect(on('a [li|nk](https://example.com)')).toEqual(['link']);
    expect(on('an <u>under|lined</u> word')).toEqual(['underline']);
    expect(on('an <u>under</u> wo|rd')).toEqual([]);
    expect(on('plain| words')).toEqual([]);
  });

  it('reads the line’s format, the caret anywhere on it', () => {
    expect(on('## A he|ading')).toEqual(['heading2']);
    expect(on('|# Title')).toEqual(['heading1']);
    expect(on('> quo|ted')).toEqual(['quote']);
    expect(on('- an it|em')).toEqual(['bullet']);
    expect(on('1. fi|rst')).toEqual(['numbered']);
    expect(on('- [ ] to d|o')).toEqual(['checklist']);
    expect(on('> **bo|ld** in a quote')).toEqual(['bold', 'quote']);
  });

  it('takes nothing from the line before, nor from a word the line starts with', () => {
    expect(on('# Title\n|Words')).toEqual([]);
    expect(on('**Bold** then plain|')).toEqual([]);
  });
});
