// The writing tools, decided on the editor's state alone: where Enter makes
// a scene break, which lines focus mode keeps bright, and which changes
// typewriter scrolling brings to the middle.

import { ensureSyntaxTree } from '@codemirror/language';
import { EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { eienMarkdown } from './syntax';
import { currentParagraph, sceneBreakAt, typewriter } from './writing-tools';

/** `doc` with the caret where "|" is (removed), parsed. */
function at(marked: string, readOnly = false): EditorState {
  const pos = marked.indexOf('|');
  const doc = marked.slice(0, pos) + marked.slice(pos + 1);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(pos),
    extensions: [eienMarkdown(), EditorState.readOnly.of(readOnly)],
  });
  ensureSyntaxTree(state, doc.length, 5_000);
  return state;
}

/** The note after Enter at "|", when Enter makes a scene break; null when it's Enter's own. */
function enter(marked: string): string | null {
  const state = at(marked);
  const spec = sceneBreakAt(state);
  if (!spec) return null;
  const next = state.update(spec).state;
  const caret = next.selection.main.head;
  return `${next.doc.sliceString(0, caret)}|${next.doc.sliceString(caret)}`;
}

describe('sceneBreakAt: Enter on an empty line after an empty line', () => {
  it('makes the line a scene break, and starts a new paragraph after it', () => {
    expect(enter('She left.\n\n|')).toBe('She left.\n\n***\n\n|');
    expect(enter('She left.\n\n  |')).toBe('She left.\n\n***\n\n|'); // spaces on the line are no words
    expect(enter('She left.\n\n|\nThe next day.')).toBe('She left.\n\n***\n\n|\nThe next day.');
  });

  it('leaves Enter alone on a line with words, or after one with words', () => {
    expect(enter('She left.|')).toBeNull();
    expect(enter('She left.\n|')).toBeNull();
    expect(enter('She left.\n\nThen |')).toBeNull();
  });

  it('never at the note’s start, after another scene break, or with words chosen', () => {
    expect(enter('\n\n|')).toBeNull();
    expect(enter('|')).toBeNull();
    expect(enter('One.\n\n***\n\n|')).toBeNull();
    const chosen = at('One.\n\n|').update({ selection: { anchor: 0, head: 6 } }).state;
    expect(sceneBreakAt(chosen)).toBeNull();
    expect(sceneBreakAt(at('One.\n\n|', true))).toBeNull();
  });

  it('never in code or the front matter, where blank lines are the writer’s', () => {
    expect(enter('```\nlet x = 1\n\n|\n```')).toBeNull();
    expect(enter('---\ntitle: x\n\n|\n---\nBody')).toBeNull();
  });
});

/** The lines focus mode keeps bright, by number. */
function bright(marked: string): number[] {
  const state = at(marked);
  const lines: number[] = [];
  currentParagraph(state).between(0, state.doc.length, (from) => {
    lines.push(state.doc.lineAt(from).number);
  });
  return lines;
}

describe('currentParagraph: what focus mode keeps bright', () => {
  it('the lines of the caret’s paragraph, up to a blank line either side', () => {
    expect(bright('One.\n\nTwo,\nst|ill two.\n\nThree.')).toEqual([3, 4]);
    expect(bright('Only| one.')).toEqual([1]);
    expect(bright('One.\n\nTwo.\nTwo too.|')).toEqual([3, 4]);
  });

  it('only the caret’s line when that line is blank', () => {
    expect(bright('One.\n|\nTwo.')).toEqual([2]);
  });
});

describe('typewriter: what brings the caret’s line to the middle', () => {
  const scrolls = (spec: TransactionSpec) => {
    const state = EditorState.create({ doc: 'One.\nTwo.', extensions: [typewriter] });
    return state.update(spec).effects.length > 0;
  };

  it('typing, deleting, undoing and moving by keys', () => {
    expect(scrolls({ changes: { from: 0, insert: 'x' }, userEvent: 'input.type' })).toBe(true);
    expect(scrolls({ changes: { from: 0, to: 1 }, userEvent: 'delete.backward' })).toBe(true);
    expect(scrolls({ changes: { from: 0, insert: 'x' }, userEvent: 'undo' })).toBe(true);
    expect(scrolls({ selection: { anchor: 6 }, userEvent: 'select' })).toBe(true);
  });

  it('never a click, or a change the writer didn’t make', () => {
    expect(scrolls({ selection: { anchor: 6 }, userEvent: 'select.pointer' })).toBe(false);
    expect(scrolls({ changes: { from: 0, insert: 'x' } })).toBe(false);
  });
});
