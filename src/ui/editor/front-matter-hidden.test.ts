// The front matter a note's first seal adds (spec §2, §9) — "id:" and
// nothing else — is out of sight in Live and Reading, and kept whole: the
// caret never rests in it and the writer's edits never reach into it.

import { EditorSelection, EditorState, Transaction } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import {
  hiddenFrontMatter,
  keepFrontMatter,
  livePreview,
  type PreviewMode,
  previewMode,
} from './live-preview';
import { eienMarkdown } from './syntax';

const SEALED = '---\nid: CSHE541J35\n---\nShe found a needle.';
const BODY = SEALED.indexOf('She');

const stateOf = (doc: string, mode: PreviewMode | null, caret = 0) =>
  EditorState.create({
    doc,
    selection: EditorSelection.cursor(caret),
    extensions: [
      eienMarkdown(),
      ...(mode ? [previewMode.of(mode), livePreview, keepFrontMatter] : []),
    ],
  });

const hiddenRanges = (state: EditorState) => {
  const out: string[] = [];
  state.field(livePreview, false)?.between(0, state.doc.length, (from, to, deco) => {
    if ((deco.spec as { block?: boolean }).block) out.push(state.doc.sliceString(from, to));
  });
  return out;
};

describe('front matter that only holds the id', () => {
  it('is out of sight in Live and Reading, and shown in Source', () => {
    expect(hiddenRanges(stateOf(SEALED, 'live'))).toEqual(['---\nid: CSHE541J35\n---']);
    expect(hiddenRanges(stateOf(SEALED, 'reading'))).toEqual(['---\nid: CSHE541J35\n---']);
    expect(hiddenFrontMatter(stateOf(SEALED, null))).toBe(0);
  });

  it('is hidden alone, even with nothing after it; front matter the writer wrote is shown', () => {
    expect(hiddenRanges(stateOf('---\nid: ABC\n---', 'live'))).toEqual(['---\nid: ABC\n---']);
    for (const doc of [
      '---\nid: null\n---\nBody', // as YAML reads it, no id at all
      '---\nid: true\n---\nBody',
      '---\nid: ABC\ntags: [fic]\n---\nBody',
      '---\ntags: [fic]\n---\nBody',
      '---\nid: ABC # mine\n---\nBody',
      'Body\n---\nid: ABC\n---\n',
      '---\nid: a/b\n---\nBody',
    ]) {
      expect(hiddenFrontMatter(stateOf(doc, 'live')), doc).toBe(0);
    }
  });

  it('never keeps the caret in it: a selection there moves to where the writing starts', () => {
    const state = stateOf(SEALED, 'live', BODY);
    const moved = state.update({ selection: EditorSelection.cursor(0) }).state;
    expect(moved.selection.main.head).toBe(BODY);
    const all = state.update({ selection: EditorSelection.range(0, SEALED.length) }).state;
    expect(all.selection.main.from).toBe(BODY);
  });

  it('refuses the writer’s edits that reach into it: Backspace at the start of the writing', () => {
    const state = stateOf(SEALED, 'live', BODY);
    const backspace = state.update({
      changes: { from: BODY - 1, to: BODY },
      annotations: Transaction.userEvent.of('delete.backward'),
    }).state;
    expect(backspace.doc.toString()).toBe(SEALED);
    const typed = state.update({
      changes: { from: BODY, insert: 'Then ' },
      annotations: Transaction.userEvent.of('input.type'),
    }).state;
    expect(typed.doc.toString()).toBe('---\nid: CSHE541J35\n---\nThen She found a needle.');
  });

  it('starts the first line typed in a note that ends with its "---" on a line of its own', () => {
    const doc = '---\nid: ABC\n---';
    const state = stateOf(doc, 'live', doc.length);
    const typed = state.update({
      changes: { from: doc.length, insert: 'Hello' },
      selection: EditorSelection.cursor(doc.length + 5),
      annotations: Transaction.userEvent.of('input.type'),
    }).state;
    expect(typed.doc.toString()).toBe('---\nid: ABC\n---\nHello');
    expect(typed.selection.main.head).toBe(typed.doc.length);
  });

  it('lets Eien’s own changes through: a reload, or a restore with a new id', () => {
    const state = stateOf(SEALED, 'live', BODY);
    const restored = state.update({
      changes: { from: 0, to: state.doc.length, insert: '---\nid: NEW\n---\nRestored.' },
    }).state;
    expect(restored.doc.toString()).toBe('---\nid: NEW\n---\nRestored.');
  });

  it('keeps the whole note when everything is chosen and typed over', () => {
    const state = stateOf(SEALED, 'live', BODY);
    const chosen = state.update({ selection: EditorSelection.range(0, SEALED.length) }).state;
    const typed = chosen.update(chosen.replaceSelection('New words.'), {
      annotations: Transaction.userEvent.of('input.type'),
    }).state;
    expect(typed.doc.toString()).toBe('---\nid: CSHE541J35\n---\nNew words.');
  });
});
