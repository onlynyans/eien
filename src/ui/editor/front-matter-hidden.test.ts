// The front matter a note's first seal adds (spec §2, §9) — "id:" and
// nothing else — is out of sight in Live and Reading, and kept whole: the
// caret never rests in it and the writer's edits never reach into it.

import { SearchQuery } from '@codemirror/search';
import {
  Compartment,
  EditorSelection,
  EditorState,
  Transaction,
  type TransactionSpec,
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from './editor';
import { countMatches } from './find-matches';
import {
  frontMatterHidden,
  frontMatterLines,
  hideTagsAndIds,
  shownMatch,
  writingStart,
} from './front-matter-hidden';
import { livePreview, type PreviewMode, previewMode } from './live-preview';
import { fromDoc, NoteDoc } from './note-doc';
import { eienMarkdown } from './syntax';

const SEALED = '---\nid: CSHE541J35\n---\nShe found a needle.';
const BODY = SEALED.indexOf('She');

const stateOf = (doc: string, mode: PreviewMode | null, caret = 0) =>
  EditorState.create({
    doc,
    selection: EditorSelection.cursor(caret),
    extensions: [
      eienMarkdown(),
      ...(mode ? [previewMode.of(mode), livePreview, frontMatterHidden] : []),
    ],
  });

const hiddenRanges = (state: EditorState) =>
  frontMatterLines(state).hidden.map((span) => state.doc.sliceString(span.from, span.to));

describe('front matter that only holds the id', () => {
  it('is out of sight in Live and Reading, and shown in Source', () => {
    expect(hiddenRanges(stateOf(SEALED, 'live'))).toEqual(['---\nid: CSHE541J35\n---']);
    expect(hiddenRanges(stateOf(SEALED, 'reading'))).toEqual(['---\nid: CSHE541J35\n---']);
    expect(writingStart(stateOf(SEALED, null))).toBe(0);
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
      expect(writingStart(stateOf(doc, 'live')), doc).toBe(0);
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

// Hide tags and IDs (backlog #45): the front matter's tags: and id: lines out of sight in
// every view, kept and saved as they are; the writer's other keys stay in sight.
describe('Hide tags and IDs', () => {
  const NOTE = '---\ntitle: Needle\ntags: [fic]\nid: CSHE541J35\n---\nShe found a fic.';
  const HIDDEN = 'tags: [fic]\nid: CSHE541J35';
  const TITLE = NOTE.indexOf('title');
  const BODY = NOTE.indexOf('She');

  const hiding = (doc: string, mode: PreviewMode | null, caret = doc.indexOf('She')) =>
    EditorState.create({
      doc,
      selection: EditorSelection.cursor(Math.max(0, caret)),
      extensions: [
        eienMarkdown(),
        hideTagsAndIds.of(true),
        frontMatterHidden,
        ...(mode ? [previewMode.of(mode), livePreview] : []),
      ],
    });
  const by = (state: EditorState, spec: TransactionSpec, event = 'input.type') =>
    state.update(spec, { annotations: Transaction.userEvent.of(event) }).state;
  /** The kept lines' text, as the file holds them. */
  const kept = (text: string) =>
    frontMatterLines(hiding(text, null)).kept.map((s) => text.slice(s.from, s.to));
  const drawnHidden = (state: EditorState) => {
    const out: string[] = [];
    for (const set of state.facet(EditorView.decorations)) {
      if (typeof set === 'function') continue;
      set.between(0, state.doc.length, (from, to, deco) => {
        if ((deco.spec as { block?: boolean }).block) out.push(state.doc.sliceString(from, to));
      });
    }
    return out;
  };

  it('hides the tags: and id: lines in Live, Source and Reading, and nothing else', () => {
    for (const mode of ['live', 'reading', null] as const) {
      expect(drawnHidden(hiding(NOTE, mode)), String(mode)).toEqual([HIDDEN]);
    }
    // Off, Source shows the file, and Live hides only front matter that is the id alone.
    expect(frontMatterLines(stateOf(NOTE, null)).hidden).toEqual([]);
    expect(frontMatterLines(stateOf(NOTE, 'live')).hidden).toEqual([]);
  });

  it('hides the whole front matter, "---" lines too, when it holds only tags and the id', () => {
    const doc = '---\ntags:\n  - fic\nid: CSHE541J35\n---\nShe found it.';
    expect(drawnHidden(hiding(doc, null))).toEqual(['---\ntags:\n  - fic\nid: CSHE541J35\n---']);
    expect(writingStart(hiding(doc, null))).toBe(doc.indexOf('She'));
  });

  it('turned on, moves a caret in the lines out of them; turned off, shows them again', () => {
    const facet = new Compartment();
    const state = EditorState.create({
      doc: NOTE,
      selection: EditorSelection.cursor(NOTE.indexOf('fic]')),
      extensions: [facet.of([]), frontMatterHidden],
    });
    const on = state.update({ effects: facet.reconfigure(hideTagsAndIds.of(true)) }).state;
    expect(on.selection.main.head).toBe(BODY);
    expect(drawnHidden(on)).toEqual([HIDDEN]);
    const off = on.update({ effects: facet.reconfigure([]) }).state;
    expect(drawnHidden(off)).toEqual([]);
    expect(off.doc.toString()).toBe(NOTE);
  });

  it('keeps the caret out of them and out of the "---" lines that hold them', () => {
    const state = hiding(NOTE, null);
    // Ctrl+Home: the start of the note is where the "---" starts, so the caret goes to the title.
    expect(by(state, { selection: { anchor: 0 } }, 'select').selection.main.head).toBe(TITLE);
    expect(
      by(state, { selection: { anchor: NOTE.indexOf('id:') } }, 'select').selection.main.head,
    ).toBe(BODY);
    // At the end of the title's line the caret may rest: typed there, it stays on that line.
    const end = NOTE.indexOf('\ntags');
    const typed = by(by(state, { selection: { anchor: end } }, 'select'), {
      changes: { from: end, insert: '!' },
    });
    expect(typed.doc.toString()).toBe(NOTE.replace('Needle', 'Needle!'));
  });

  it('types what’s put at the very start of the note after the front matter’s lines', () => {
    const doc = '---\ntags: [fic]\n---\nShe found it.';
    const typed = by(hiding(doc, 'live'), { changes: { from: 0, insert: 'Then ' } });
    expect(typed.doc.toString()).toBe('---\ntags: [fic]\n---\nThen She found it.');
    expect(by(hiding(NOTE, null), { changes: { from: 0, insert: 'x' } }).doc.toString()).toBe(
      NOTE.replace('title', 'xtitle'),
    );
  });

  it('keeps the lines and their "---" when everything is chosen and typed over, or deleted', () => {
    const state = hiding(NOTE, null);
    const all = by(state, { selection: EditorSelection.range(0, NOTE.length) }, 'select');
    expect(all.selection.main.from).toBe(TITLE);
    const typed = by(all, all.replaceSelection('New words.'));
    expect(typed.doc.toString()).toBe(`---\n\n${HIDDEN}\n---\nNew words.`);
    expect(typed.selection.main.head).toBe(typed.doc.length);
    const deleted = by(all, all.replaceSelection(''), 'delete.selection');
    expect(deleted.doc.toString()).toBe(`---\n\n${HIDDEN}\n---\n`);
    // With the title gone, all the front matter holds is hidden: it goes out of sight whole.
    expect(kept(deleted.doc.toString())).toEqual([`---\n\n${HIDDEN}\n---`]);
    // The caret where the writing starts, so what's typed next follows the front matter.
    const next = by(deleted, deleted.replaceSelection('Again.'));
    expect(next.doc.toString()).toBe(`---\n\n${HIDDEN}\n---\nAgain.`);
  });

  it('refuses Backspace and Delete that would join a line in sight to them', () => {
    const state = hiding(NOTE, null);
    const back = by(state, { changes: { from: BODY - 1, to: BODY } }, 'delete.backward');
    expect(back.doc.toString()).toBe(NOTE);
    const end = NOTE.indexOf('\ntags');
    const forward = by(state, { changes: { from: end, to: end + 1 } }, 'delete.forward');
    expect(forward.doc.toString()).toBe(NOTE);
  });

  it('lets Eien’s own changes in: a seal’s id, the page’s tags, a reload, the history', () => {
    const state = hiding(NOTE, null);
    const tagged = state.update({ changes: { from: NOTE.indexOf(']'), insert: ', draft' } }).state;
    expect(tagged.doc.toString()).toBe(NOTE.replace('[fic]', '[fic, draft]'));
    const undone = state.update({
      changes: { from: NOTE.indexOf('fic'), to: NOTE.indexOf('fic') + 3, insert: 'draft' },
      annotations: [Transaction.userEvent.of('undo'), fromDoc.of('own')],
    }).state;
    expect(undone.doc.toString()).toBe(NOTE.replace('[fic]', '[draft]'));
  });

  it('drops a replace that falls in them, and finds no match there', () => {
    const state = hiding(NOTE, null);
    const at = NOTE.indexOf('fic');
    const replaced = by(
      state,
      {
        changes: [
          { from: at, to: at + 3, insert: 'x' },
          { from: NOTE.lastIndexOf('fic'), to: NOTE.lastIndexOf('fic') + 3, insert: 'x' },
        ],
      },
      'input.replace.all',
    );
    expect(replaced.doc.toString()).toBe(NOTE.replace(/fic\.$/, 'x.'));
    const query = new SearchQuery({ search: 'fic', test: shownMatch });
    expect(countMatches(state, query)).toEqual({ current: 0, total: 1, more: false });
    expect(
      countMatches(stateOf(NOTE, null), new SearchQuery({ search: 'fic', test: shownMatch })),
    ).toEqual({
      current: 0,
      total: 2,
      more: false,
    });
  });

  it('leaves them out of a copy of everything, and copies the rest as it is', () => {
    const state = by(
      hiding(NOTE, null),
      { selection: EditorSelection.range(0, NOTE.length) },
      'select',
    );
    const copy = (s: EditorState) =>
      s
        .facet(EditorView.clipboardOutputFilter)
        .reduce(
          (text, filter) => filter(text, s),
          s.sliceDoc(s.selection.main.from, s.selection.main.to),
        );
    expect(copy(state)).toBe('title: Needle\n---\nShe found a fic.');
    const body = by(state, { selection: EditorSelection.range(BODY, NOTE.length) }, 'select');
    expect(copy(body)).toBe('She found a fic.');
  });
});

describe('Hide tags and IDs, in the editor: find and replace', () => {
  const NOTE = '---\ntags: [bell]\nid: CSHE541J35\n---\nThe bell rang.';
  let editor: NoteEditor;

  beforeEach(() => {
    const host = document.body.appendChild(document.createElement('div'));
    editor = new NoteEditor(host, { changed: () => {}, follow: () => {} });
    editor.setTagsAndIdsHidden(true);
    editor.show(new NoteDoc(NOTE), async () => null);
    document.body.append(editor.find.element);
    vi.spyOn(editor.view, 'focus').mockImplementation(() => {});
  });
  afterEach(() => {
    editor.destroy();
    document.body.replaceChildren();
  });

  it('opens with the caret where the writing starts, and replaces all in sight alone', () => {
    expect(editor.view.state.selection.main.head).toBe(NOTE.indexOf('The'));
    editor.find.open(true);
    const field = (name: string) =>
      editor.find.element.querySelector<HTMLInputElement>(
        `input[aria-label="${name}"]`,
      ) as HTMLInputElement;
    for (const [name, value] of [
      ['Find', 'bell'],
      ['Replace', 'gong'],
    ] as const) {
      field(name).value = value;
      field(name).dispatchEvent(new Event('input'));
    }
    expect(editor.find.element.querySelector('[role="status"]')?.textContent).toBe('1 of 1');
    editor.find.element
      .querySelector<HTMLButtonElement>('button[aria-label="Replace all"]')
      ?.click();
    expect(editor.text).toBe('---\ntags: [bell]\nid: CSHE541J35\n---\nThe gong rang.');
  });
});
