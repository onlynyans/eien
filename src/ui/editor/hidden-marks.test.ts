// Live with "Show Markdown marks" off: what Backspace and Delete do beside a
// hidden mark, decided on the editor's state alone. "‸" is the caret, «…» a
// selection.

import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { deleteAcrossMarks } from './hidden-marks';
import { replacedRanges } from './hidden-ranges';
import { livePreview, previewMode, showMarks } from './live-preview';
import { eienMarkdown } from './syntax';

function stateOf(marked: string): EditorState {
  const doc = marked.replace(/[‸«»]/gu, '');
  const caret = marked.indexOf('‸');
  const selection =
    caret >= 0
      ? EditorSelection.cursor(caret)
      : EditorSelection.range(marked.indexOf('«'), marked.indexOf('»') - 1);
  return EditorState.create({
    doc,
    selection,
    extensions: [eienMarkdown(), previewMode.of('live'), showMarks.of(false), livePreview],
  });
}

/** The note after the key, or null where the editor's own key does it. */
function pressed(marked: string, key: 'Backspace' | 'Delete'): string | null {
  const state = stateOf(marked);
  const spec = deleteAcrossMarks(state, key === 'Delete');
  return spec ? state.update(spec).state.doc.toString() : null;
}

describe('Backspace with the marks hidden', () => {
  it('takes the letter before a closing mark, not the mark', () => {
    expect(pressed('A **bold**‸ word', 'Backspace')).toBe('A **bol** word');
  });

  it('takes the marks too when the format is left with nothing in it', () => {
    expect(pressed('A **b**‸ word', 'Backspace')).toBe('A  word');
    expect(pressed('A **b‸** word', 'Backspace')).toBe('A  word');
    expect(pressed('see [a](x.md)‸ now', 'Backspace')).toBe('see  now');
  });

  it('takes a line’s format off at its start: a heading, a quote', () => {
    expect(pressed('## ‸Title', 'Backspace')).toBe('Title');
    expect(pressed('> ‸said', 'Backspace')).toBe('said');
  });

  it('joins the line to the one before, over an opening mark, leaving the mark whole', () => {
    expect(pressed('one\n**‸two**', 'Backspace')).toBe('one**two**');
  });

  it('never eats a table’s pipe: a cell’s edge stays put', () => {
    expect(pressed('| a |‸ b |\n|---|---|', 'Backspace')).toBe('| a | b |\n|---|---|');
  });

  it('leaves plain text to the editor', () => {
    expect(pressed('plain‸ text', 'Backspace')).toBeNull();
    expect(pressed('A **bo‸ld** word', 'Backspace')).toBeNull();
  });

  it('takes a format’s marks with the whole of what it held, chosen', () => {
    expect(pressed('A **«bold»** word', 'Backspace')).toBe('A  word');
    expect(pressed('A **«bo»ld** word', 'Backspace')).toBeNull();
  });
});

describe('Delete with the marks hidden', () => {
  it('takes the letter after an opening mark, not the mark', () => {
    expect(pressed('A ‸**bold** word', 'Delete')).toBe('A **old** word');
  });

  it('takes the marks too when the format is left with nothing in it', () => {
    expect(pressed('A ‸**b** word', 'Delete')).toBe('A  word');
  });

  it('never eats a table’s pipe', () => {
    expect(pressed('| a‸ | b |\n|---|---|', 'Delete')).toBeNull(); // a space before the pipe: the editor’s
    expect(pressed('| a ‸| b |\n|---|---|', 'Delete')).toBe('| a | b |\n|---|---|');
  });
});

describe('what the caret steps over whole', () => {
  it('is every hidden mark and widget, and nothing that’s only a look', () => {
    const state = stateOf('## A **b** ![i](i.png)\n\n- [ ] task\n\n‸x');
    const covered: string[] = [];
    replacedRanges(state.field(livePreview)).between(0, state.doc.length, (from, to) => {
      covered.push(state.doc.sliceString(from, to));
    });
    expect(covered).toEqual(['## ', '**', '**', '![i](i.png)', '- ', '[ ]']);
  });
});
