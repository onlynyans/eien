import { undo } from '@codemirror/commands';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from './editor';
import { NoteDoc } from './note-doc';

// Matches, without case: "bell" (4), "Bell" in "Bells" (15), "bell" (26).
const NOTE = 'The bell rang. Bells. The bell again.';

let editor: NoteEditor;
let doc: NoteDoc;
let focused: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  const host = document.body.appendChild(document.createElement('div'));
  editor = new NoteEditor(host, { changed: () => {}, follow: () => {} });
  doc = new NoteDoc(NOTE);
  editor.show(doc, async () => null);
  // The page lays the bar over the editor (../page/page.ts).
  document.body.append(editor.find.element);
  // happy-dom fires selectionchange mid-update when an editor has the keyboard: it stays out.
  focused = vi.fn<() => void>();
  vi.spyOn(editor.view, 'focus').mockImplementation(focused);
});

afterEach(() => {
  editor.destroy();
  document.body.replaceChildren();
});

const bar = () => editor.find.element;
const field = (name: 'Find' | 'Replace') =>
  bar().querySelector<HTMLInputElement>(`input[aria-label="${name}"]`) as HTMLInputElement;
const button = (name: string) =>
  bar().querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`) as HTMLButtonElement;
const count = () => bar().querySelector('[role="status"]')?.textContent;
const chosen = () => {
  const { from, to } = editor.view.state.selection.main;
  return [from, to];
};
const type = (input: HTMLInputElement, text: string) => {
  input.value = text;
  input.dispatchEvent(new Event('input'));
};
/** A key, off the Mac (happy-dom's navigator isn't one): Mod is Ctrl. */
const press = (target: EventTarget, key: string, mods: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }),
  );
const undoOnce = () => doc.run(editor.view, undo);

describe('find in the note', () => {
  it('makes none of its controls until it’s first asked for: each page has one', () => {
    expect(bar().childElementCount).toBe(0);
    editor.find.open(false);
    expect(field('Find')).not.toBeNull();
  });

  it('opens on Ctrl+F in the text, the keyboard in its field, drawn outside the editor', () => {
    expect(bar().hidden).toBe(true);
    press(editor.view.contentDOM, 'f', { ctrlKey: true });
    expect(bar().hidden).toBe(false);
    expect(document.activeElement).toBe(field('Find'));
    // CodeMirror's own panel is an empty placeholder in the shadow root.
    expect(editor.view.dom.querySelector('input')).toBeNull();
    expect(bar().getRootNode()).toBe(document);
  });

  it('goes to the first match from the caret as the query is typed, and counts', () => {
    editor.view.dispatch({ selection: { anchor: 10 } });
    editor.find.open(false);
    type(field('Find'), 'bell');
    expect(chosen()).toEqual([15, 19]);
    expect(count()).toBe('2 of 3');
    // A letter more narrows from the same match: it doesn't step on past it.
    type(field('Find'), 'bells');
    expect(chosen()).toEqual([15, 20]);
    expect(count()).toBe('1 of 1');
    type(field('Find'), 'gong');
    expect(count()).toBe('No matches');
  });

  it('seeds the field with the chosen words', () => {
    editor.view.dispatch({ selection: { anchor: 26, head: 30 } });
    editor.find.open(false);
    expect(field('Find').value).toBe('bell');
    expect(count()).toBe('3 of 3');
  });

  it('steps to the next and previous match with Enter, Shift+Enter, Ctrl+G and Ctrl+Shift+G, round the note', () => {
    editor.find.open(false);
    type(field('Find'), 'bell');
    expect(count()).toBe('1 of 3');
    press(field('Find'), 'Enter');
    expect(count()).toBe('2 of 3');
    press(field('Find'), 'g', { ctrlKey: true });
    expect(count()).toBe('3 of 3');
    press(field('Find'), 'g', { ctrlKey: true });
    expect(count()).toBe('1 of 3');
    press(field('Find'), 'Enter', { shiftKey: true });
    expect(count()).toBe('3 of 3');
    press(field('Find'), 'G', { ctrlKey: true, shiftKey: true, keyCode: 71 });
    expect(count()).toBe('2 of 3');
    button('Next match').click();
    expect(count()).toBe('3 of 3');
    button('Previous match').click();
    expect(count()).toBe('2 of 3');
  });

  it('goes back with Ctrl+Shift+G however its G arrives: Caps Lock sends a lower-case g', () => {
    editor.find.open(false);
    type(field('Find'), 'bell');
    expect(count()).toBe('1 of 3');
    press(field('Find'), 'g', { ctrlKey: true, shiftKey: true, keyCode: 71 });
    expect(count()).toBe('3 of 3');
    press(editor.view.contentDOM, 'g', { ctrlKey: true, shiftKey: true, keyCode: 71 });
    expect(count()).toBe('2 of 3');
    // And Ctrl+G, Shift let go, goes on again.
    press(editor.view.contentDOM, 'g', { ctrlKey: true, keyCode: 71 });
    expect(count()).toBe('3 of 3');
  });

  it('shows every control at once, the options in the field, and fades what can’t act', () => {
    editor.find.open(true);
    // None is quiet (out of sight till hovered): a slip with holes in it is no slip.
    expect(bar().querySelector('.icon-button--quiet')).toBeNull();
    expect(field('Find').parentElement?.contains(button('Match case'))).toBe(true);
    const faded = () =>
      ['Previous match', 'Next match', 'Replace', 'Replace all'].map((name) =>
        button(name).getAttribute('aria-disabled'),
      );
    type(field('Find'), 'bell');
    expect(faded()).toEqual(['false', 'false', 'false', 'false']);
    type(field('Find'), 'gong');
    expect(faded()).toEqual(['true', 'true', 'true', 'true']);
  });

  it('matches case, whole words and patterns when they’re pressed', () => {
    editor.find.open(false);
    type(field('Find'), 'bell');
    button('Match case').click();
    expect(button('Match case').getAttribute('aria-pressed')).toBe('true');
    expect(count()).toBe('1 of 2');
    button('Match case').click();
    button('Whole word').click();
    expect(count()).toBe('1 of 2');
    button('Whole word').click();
    button('Pattern (regular expression)').click();
    type(field('Find'), 'b[e]ll?s');
    expect(count()).toBe('1 of 1');
    type(field('Find'), 'bell(');
    expect(count()).toBe('Not a valid pattern');
    expect(field('Find').getAttribute('aria-invalid')).toBe('true');
  });

  it('replaces all in one step of the note’s history', () => {
    editor.find.open(true);
    type(field('Find'), 'bell');
    type(field('Replace'), 'gong');
    button('Replace all').click();
    expect(editor.text).toBe('The gong rang. gongs. The gong again.');
    expect(doc.text).toBe(editor.text);
    expect(count()).toBe('No matches');
    expect(undoOnce()).toBe(true);
    expect(editor.text).toBe(NOTE);
    expect(undoOnce()).toBe(false);
  });

  it('replaces one with Enter in the Replace field, each its own step, and moves on', () => {
    editor.find.open(true);
    type(field('Find'), 'bell');
    type(field('Replace'), 'gong');
    press(field('Replace'), 'Enter');
    expect(editor.text).toBe('The gong rang. Bells. The bell again.');
    expect(count()).toBe('1 of 2');
    press(field('Replace'), 'Enter');
    expect(editor.text).toBe('The gong rang. gongs. The bell again.');
    expect(undoOnce()).toBe(true);
    expect(editor.text).toBe('The gong rang. Bells. The bell again.');
    expect(undoOnce()).toBe(true);
    expect(editor.text).toBe(NOTE);
  });

  it('replaces all with Ctrl+Alt+Enter from either field', () => {
    editor.find.open(true);
    type(field('Find'), 'bell');
    type(field('Replace'), 'gong');
    press(field('Find'), 'Enter', { ctrlKey: true, altKey: true });
    expect(editor.text).toBe('The gong rang. gongs. The gong again.');
  });

  it('opens with Replace unfolded on Ctrl+H, the keyboard in Replace when there’s a query', () => {
    editor.view.dispatch({ selection: { anchor: 4, head: 8 } });
    press(editor.view.contentDOM, 'h', { ctrlKey: true });
    expect(field('Replace').hidden).toBe(false);
    expect(button('Find and replace').getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(field('Replace'));
  });

  it('shuts on Esc, the keyboard back in the text on the current match', () => {
    editor.find.open(false);
    type(field('Find'), 'bell');
    press(field('Find'), 'Enter');
    press(field('Find'), 'Escape');
    expect(bar().hidden).toBe(true);
    expect(focused).toHaveBeenCalled();
    expect(chosen()).toEqual([15, 19]);
    // The matches aren't marked once it's shut.
    expect(editor.view.contentDOM.querySelector('.cm-searchMatch')).toBeNull();
  });

  it('finds in Reading, where nothing can be replaced', () => {
    editor.setMode('reading');
    editor.find.open(true);
    type(field('Find'), 'bell');
    expect(count()).toBe('1 of 3');
    expect(field('Replace').disabled).toBe(true);
    expect(button('Replace all').disabled).toBe(true);
  });

  it('shuts when another note is shown', () => {
    editor.find.open(false);
    editor.show(new NoteDoc('Another.'), async () => null);
    expect(bar().hidden).toBe(true);
  });
});
