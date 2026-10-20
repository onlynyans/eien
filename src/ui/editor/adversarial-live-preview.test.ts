// Adversarial: what Live and Reading draw for text a writer types that only
// looks like Markdown, and for the HTML and front matter the spec allows.

import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { livePreview, type PreviewMode, previewMode } from './live-preview';
import { eienMarkdown } from './syntax';

/** What `mode` hides and draws for `doc`, the caret at its very end. */
function show(doc: string, mode: PreviewMode = 'reading') {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(doc.length),
    extensions: [eienMarkdown(), previewMode.of(mode), livePreview],
  });
  const hidden: string[] = [];
  const widgets: string[] = [];
  state.field(livePreview).between(0, doc.length, (from, to, deco) => {
    const spec = deco.spec as { widget?: object; class?: string };
    if (spec.widget) widgets.push(`${spec.widget.constructor.name}:${doc.slice(from, to)}`);
    else if (!spec.class) hidden.push(doc.slice(from, to));
  });
  return { hidden, widgets };
}

describe('square brackets a writer types are words, not a link', () => {
  // CommonMark: "[sic]" with no "[sic]: address" anywhere is plain text, brackets and all.
  it.each([
    'He wrote it [sic] twice.',
    'She said [...] and left.',
    'The letter was signed [redacted].',
  ])('%j keeps its brackets in Reading', (doc) => {
    expect(show(doc).hidden).toEqual([]);
  });
});

describe('the basic HTML of spec §4, at the start of a line', () => {
  it('hides <p> and </p>, as it does mid-line', () => {
    expect(show('<p>The scarf catches.</p>\n\nx').hidden).toEqual(['<p>', '</p>']);
  });

  it('draws <hr> as the scene break it draws mid-line', () => {
    expect(show('<hr>\n\nx').widgets).toEqual(['SceneBreakWidget:<hr>']);
  });
});

describe('front matter (spec §2)', () => {
  it('is never drawn as a scene break', () => {
    const doc = '---\nid: 01JB2X4Q7Z\ntags: [fic/aot, draft]\n---\nBody';
    expect(show(doc).widgets).toEqual([]);
  });
});
