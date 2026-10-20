// Adversarial: the hidden front matter a note's first seal adds (spec §2, §9),
// against the writer's keys: a note that is only its id, a drop at the very
// top, and an input method's composition.

import { EditorSelection, EditorState, Transaction } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { noteIdOf } from '../../core/versions';
import { hiddenFrontMatter, keepFrontMatter, livePreview, previewMode } from './live-preview';
import { eienMarkdown } from './syntax';

const live = (doc: string, caret: number) =>
  EditorState.create({
    doc,
    selection: EditorSelection.cursor(caret),
    extensions: [eienMarkdown(), previewMode.of('live'), livePreview, keepFrontMatter],
  });

const typed = (state: EditorState, text: string, event = 'input.type') =>
  state.update(state.replaceSelection(text), {
    annotations: Transaction.userEvent.of(event),
  }).state;

describe('a note that is only its id', () => {
  it('typing in it, when no line end follows the closing "---", keeps the id', () => {
    // Opened with the caret where the writing starts: the first letter joins "---" and the id is gone.
    const doc = '---\nid: ABCDEFGHJK\n---';
    const state = live(doc, hiddenFrontMatter(live(doc, 0)));
    const after = typed(state, 'Hello');
    expect(noteIdOf(after.doc.toString())).toBe('ABCDEFGHJK');
    expect(after.doc.toString()).toContain('Hello');
  });
});

describe('hardening: the writer’s keys at the top of a sealed note', () => {
  const SEALED = '---\nid: ABCDEFGHJK\n---\nShe found a needle.';
  const START = SEALED.indexOf('She');

  it('a drop at the very top (a drag of words from below) changes nothing rather than half', () => {
    const state = live(SEALED, START);
    const dropped = state.update({
      changes: [
        { from: 0, insert: 'needle' },
        { from: SEALED.length - 'needle.'.length, to: SEALED.length - 1 },
      ],
      annotations: Transaction.userEvent.of('move.drop'),
    }).state;
    expect([SEALED, '---\nid: ABCDEFGHJK\n---\nneedleShe found a .']).toContain(
      dropped.doc.toString(),
    );
    expect(noteIdOf(dropped.doc.toString())).toBe('ABCDEFGHJK');
  });

  it('an input method’s composition at the start of the writing lands there', () => {
    const after = typed(live(SEALED, START), '彼女は', 'input.type.compose');
    expect(after.doc.toString()).toBe('---\nid: ABCDEFGHJK\n---\n彼女はShe found a needle.');
  });
});
