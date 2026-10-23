import { redo, undo } from '@codemirror/commands';
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from './editor';
import { NoteDoc } from './note-doc';

/** The document each editor shows, for the history commands. */
const documents = new WeakMap<NoteEditor, NoteDoc>();

/** Two editors, as the split's two sides, showing one note; what each one told. */
function twoViews(text: string) {
  const told: { side: 'a' | 'b'; text: string; written: boolean }[] = [];
  const editor = (side: 'a' | 'b') => {
    const host = document.body.appendChild(document.createElement('div'));
    const made = new NoteEditor(host, {
      changed: (now, written) => told.push({ side, text: now, written }),
      follow: () => {},
    });
    // happy-dom fires selectionchange mid-update when an editor has the keyboard: it stays out.
    vi.spyOn(made.view, 'focus').mockImplementation(() => {});
    return made;
  };
  const doc = new NoteDoc(text);
  const a = editor('a');
  const b = editor('b');
  a.show(doc, async () => null);
  b.show(doc, async () => null);
  documents.set(a, doc);
  documents.set(b, doc);
  const type = (on: NoteEditor, at: number, words: string) =>
    on.view.dispatch({ changes: { from: at, insert: words }, userEvent: 'input.type' });
  return { doc, a, b, told, type };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('one note on both sides: one document (the split)', () => {
  it('shows typing on one side on the other at once, told once, by the side it was typed in', () => {
    const { doc, a, b, told, type } = twoViews('Snow.');
    type(a, 5, ' The gate held.');
    expect(b.text).toBe('Snow. The gate held.');
    expect(doc.text).toBe('Snow. The gate held.');
    expect(told).toEqual([{ side: 'a', text: 'Snow. The gate held.', written: true }]);
  });

  it('undoes on one side what was typed on the other: one history, the note’s', () => {
    const { a, b, told, type } = twoViews('Snow.');
    type(a, 5, ' The gate held.');
    told.length = 0;
    // ⌘Z in B: B's own change, the writer's (an undo counts), told by B alone.
    expect(runOn(b, undo)).toBe(true);
    expect(a.text).toBe('Snow.');
    expect(b.text).toBe('Snow.');
    expect(told).toEqual([{ side: 'b', text: 'Snow.', written: true }]);
    expect(runOn(a, redo)).toBe(true);
    expect(b.text).toBe('Snow. The gate held.');
  });

  it('takes the undo key on either side to the document', () => {
    const { a, b, type } = twoViews('Snow.');
    type(a, 5, ' Rain.');
    // happy-dom's platform isn't a Mac's: the modifier is Ctrl.
    const key = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    b.view.contentDOM.dispatchEvent(key);
    expect(a.text).toBe('Snow.');
  });

  it('takes the Edit menu’s Undo, which arrives as an input event, on the document', () => {
    const { a, b, type } = twoViews('Snow.');
    type(a, 5, ' Rain.');
    const event = new InputEvent('beforeinput', { inputType: 'historyUndo', cancelable: true });
    b.view.contentDOM.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(a.text).toBe('Snow.');
  });

  it('starts the history afresh on a reload from elsewhere, which no side tells', () => {
    const { doc, a, b, told, type } = twoViews('Snow.');
    type(a, 5, ' Mine.');
    told.length = 0;
    doc.replace('Another device’s words.');
    expect(b.text).toBe('Another device’s words.');
    expect(told).toEqual([]);
    expect(runOn(a, undo)).toBe(false); // ⌘Z never steps back over the other device's words
    expect(a.text).toBe('Another device’s words.');
  });

  it('keeps Eien’s change Eien’s: a seal’s id can’t be undone; a restore can', () => {
    const { a, b, told, type } = twoViews('Snow.');
    type(a, 5, ' Typed.');
    told.length = 0;
    expect(a.amend('id: 1\nSnow. Typed.', false)).toBe(true);
    expect(b.text).toBe('id: 1\nSnow. Typed.');
    expect(told).toEqual([{ side: 'a', text: 'id: 1\nSnow. Typed.', written: false }]);
    expect(runOn(b, undo)).toBe(true); // takes back the typing, not the id
    expect(a.text).toBe('id: 1\nSnow.');
    expect(a.amend('Restored.', true)).toBe(true);
    expect(runOn(b, undo)).toBe(true);
    expect(a.text).toBe('id: 1\nSnow.');
  });

  it('lets a side go: its view no longer hears the note, and the note keeps its other side', () => {
    const { doc, a, b, type } = twoViews('Snow.');
    b.release();
    expect(doc.shown).toBe(1);
    type(a, 5, ' Alone.');
    expect(b.text).toBe('');
    expect(doc.text).toBe('Snow. Alone.');
  });
});

describe('one note on both sides, under random edits', () => {
  it('leaves both sides and the document holding the same text', () => {
    const edit = fc.record({
      side: fc.constantFrom('a', 'b', 'undo', 'redo'),
      at: fc.nat(),
      cut: fc.nat({ max: 6 }),
      words: fc.string({ maxLength: 6 }),
    });
    fc.assert(
      fc.property(
        fc.string({ maxLength: 20 }),
        fc.array(edit, { maxLength: 25 }),
        (start, edits) => {
          const { doc, a, b } = twoViews(start);
          for (const { side, at, cut, words } of edits) {
            if (side === 'undo') runOn(b, undo);
            else if (side === 'redo') runOn(a, redo);
            else {
              const on = side === 'a' ? a : b;
              const length = on.view.state.doc.length;
              const from = at % (length + 1);
              const to = Math.min(length, from + cut);
              on.view.dispatch({ changes: { from, to, insert: words }, userEvent: 'input.type' });
            }
            expect(a.text).toBe(doc.text);
            expect(b.text).toBe(doc.text);
          }
          document.body.replaceChildren();
        },
      ),
      { numRuns: 120 },
    );
  });
});

/** Run a history command as a side's keys do: on the note's document, for that side. */
function runOn(editor: NoteEditor, command: typeof undo): boolean {
  return documents.get(editor)?.run(editor.view, command) ?? false;
}
