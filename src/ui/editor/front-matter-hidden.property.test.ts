// With Hide tags and IDs on, whatever the writer chooses and types or deletes,
// in any view that edits, the lines out of sight before an edit are still in
// the note after it, byte for byte and as whole lines, in their order. (An edit to a key in sight can
// still break the YAML: then nothing is hidden, and the lines show again.)

import { EditorSelection, EditorState, Transaction } from '@codemirror/state';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { tagAndIdLines } from '../../core/note';
import { frontMatterHidden, hideTagsAndIds } from './front-matter-hidden';
import { livePreview, previewMode } from './live-preview';
import { eienMarkdown } from './syntax';

const FRONTS = [
  '---\ntags: [fic]\nid: CSHE541J35\n---',
  '---\ntitle: Needle\ntags:\n  - fic\n  - draft\nid: CSHE541J35\n---',
  '---\nid: CSHE541J35\nsummary: A tale\ntags: fic draft # mine\n---',
  '---\ntags: [fic]\n---',
];

/** The runs of lines out of sight, as written. */
const hiddenRuns = (text: string) =>
  tagAndIdLines(text).hidden.map((span) => text.slice(span.from, span.to));

/** Whether each of `runs` is in `text` as whole lines, in order. */
function holds(text: string, runs: readonly string[]): boolean {
  const lines = `\n${text}\n`;
  let at = 0;
  for (const run of runs) {
    const found = lines.indexOf(`\n${run}\n`, at);
    if (found < 0) return false;
    at = found + run.length + 1;
  }
  return true;
}

const edit = fc.oneof(
  fc.record({
    kind: fc.constant('type' as const),
    text: fc.constantFrom('x', '\n', '---', 'tags: [y]\n', ''),
  }),
  fc.record({ kind: fc.constantFrom('delete.backward' as const, 'delete.forward' as const) }),
);

describe('the hidden lines, against the writer’s edits', () => {
  it('stay byte for byte, whole lines in order, after any choice and edit', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FRONTS),
        fc.constantFrom('', '\n', '\nShe found a needle.\n\n# Two'),
        fc.constantFrom<'live' | null>('live', null),
        fc.array(fc.tuple(fc.nat(), fc.nat(), edit), { minLength: 1, maxLength: 6 }),
        (front, body, mode, steps) => {
          const doc = front + body;
          let state = EditorState.create({
            doc,
            extensions: [
              eienMarkdown(),
              hideTagsAndIds.of(true),
              frontMatterHidden,
              ...(mode ? [previewMode.of(mode), livePreview] : []),
            ],
          });
          for (const [a, b, step] of steps) {
            const length = state.doc.length + 1;
            state = state.update({
              selection: EditorSelection.range(a % length, b % length),
              annotations: Transaction.userEvent.of('select'),
            }).state;
            const { from, to, empty } = state.selection.main;
            const spec =
              step.kind === 'type'
                ? state.replaceSelection(step.text)
                : empty
                  ? step.kind === 'delete.backward'
                    ? { changes: { from: Math.max(0, from - 1), to: from } }
                    : { changes: { from, to: Math.min(state.doc.length, from + 1) } }
                  : { changes: { from, to } };
            const event = step.kind === 'type' ? 'input.type' : step.kind;
            const before = hiddenRuns(state.doc.toString());
            state = state.update(spec, { annotations: Transaction.userEvent.of(event) }).state;
            expect(holds(state.doc.toString(), before), state.doc.toString()).toBe(true);
          }
        },
      ),
    );
  });
});
