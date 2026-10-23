// What Live and Reading show, decided on the editor's state alone: which
// marks hide, what becomes a widget, and what the caret's lines keep.

import { syntaxTree } from '@codemirror/language';
import { Compartment, EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { livePreview, type PreviewMode, previewMode, showMarks } from './live-preview';
import { eienMarkdown } from './syntax';

interface Shown {
  readonly hidden: string[];
  readonly widgets: string[];
  readonly marks: string[];
  readonly lines: string[];
}

/** The note `doc` with the caret at `caret` (a character index), in `mode`. */
function show(doc: string, caret: number, mode: PreviewMode | null): Shown {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(Math.min(caret, doc.length)),
    extensions: [eienMarkdown(), ...(mode ? [previewMode.of(mode)] : []), livePreview],
  });
  const shown: Shown = { hidden: [], widgets: [], marks: [], lines: [] };
  state.field(livePreview).between(0, doc.length, (from, to, deco) => {
    const spec = deco.spec as { widget?: object; class?: string; attributes?: object };
    if (spec.widget) shown.widgets.push(`${spec.widget.constructor.name}:${doc.slice(from, to)}`);
    else if (from === to && spec.class)
      shown.lines.push(`${spec.class}@${state.doc.lineAt(from).number}`);
    else if (spec.class) shown.marks.push(`${spec.class}:${doc.slice(from, to)}`);
    else shown.hidden.push(doc.slice(from, to));
  });
  return shown;
}

const END = 10_000; // a caret past the end: on the last line
const marks = new Compartment();

describe('Live', () => {
  it('hides emphasis marks away from the caret, and keeps them on its line', () => {
    const doc = 'A **bold** and *soft* word.\n\nThe caret is here.';
    expect(show(doc, END, 'live').hidden).toEqual(['**', '**', '*', '*']);
    expect(show(doc, 3, 'live').hidden).toEqual([]); // caret on line 1: its marks stay
  });

  it('hides a heading’s "#" and its space, and styles the line', () => {
    const shown = show('## Seventeen\n\ntext', END, 'live');
    expect(shown.hidden).toEqual(['## ']);
    expect(shown.lines).toContain('eien-h2@1');
  });

  it('draws ==highlight== and ~~strike~~ without their marks', () => {
    const shown = show('The one that ==isn’t split== and ~~gentle~~.\n\nx', END, 'live');
    expect(shown.hidden).toEqual(['==', '==', '~~', '~~']);
    expect(shown.marks).toContain('eien-highlight:==isn’t split==');
  });

  it('shows a link’s words, and hides the brackets and the address', () => {
    const shown = show('See [the archive](https://archiveofourown.org) now.\n\nx', END, 'live');
    expect(shown.marks).toContain('eien-link:the archive');
    expect(shown.hidden).toEqual(['[', '](https://archiveofourown.org)']);
  });

  it('shows a [[wiki link]] as a link, its brackets hidden', () => {
    const shown = show('See [[Ideas — winter arc]].\n\nx', END, 'live');
    expect(shown.marks).toContain('eien-link:[[Ideas — winter arc]]');
    expect(shown.hidden).toEqual(['[[', ']]']);
  });

  it('turns task markers into checkboxes and hides the list dash', () => {
    const shown = show('- [ ] Summary\n- [x] Tags\n\nx', END, 'live');
    expect(shown.widgets).toEqual(['CheckboxWidget:[ ]', 'CheckboxWidget:[x]']);
    expect(shown.hidden).toEqual(['- ', '- ']);
    expect(shown.marks).toContain('eien-done: Tags');
  });

  it('draws "***" as a scene break, but not on the caret’s line', () => {
    const doc = 'one\n\n***\n\ntwo';
    expect(show(doc, END, 'live').widgets).toEqual(['SceneBreakWidget:***']);
    expect(show(doc, doc.indexOf('***'), 'live').widgets).toEqual([]);
  });

  it('draws a table in place, its pipes and delimiter row hidden, the caret’s row showing its pipes', () => {
    const doc = '| a | b |\n|---|---|\n| 1 | 2 |\n\nafter';
    const away = show(doc, END, 'live');
    expect(away.widgets).toEqual([]);
    expect(away.hidden).toEqual(['|', '|', '|', '|---|---|', '|', '|', '|']);
    expect(away.lines).toEqual(
      expect.arrayContaining(['eien-table-row@1', 'eien-table-head@1', 'eien-table-row@3']),
    );
    const editing = show(doc, doc.indexOf('1'), 'live');
    expect(editing.hidden).toEqual(['|', '|', '|', '|---|---|']); // the header’s, and the delimiter row
    expect(editing.marks.filter((m) => m.startsWith('eien-table-pipe'))).toHaveLength(3);
  });

  it('formats the words in a table’s cells as anywhere else', () => {
    const doc = '| **Project** | *due* |\n|---|---|\n| `x` | ==now== |\n\nafter';
    const shown = show(doc, END, 'live');
    expect(shown.hidden).toEqual(expect.arrayContaining(['**', '**', '*', '*', '==', '==']));
    expect(shown.marks).toEqual(
      expect.arrayContaining(['eien-code:`x`', 'eien-highlight:==now==']),
    );
  });

  it('draws an image, and the raw syntax on the caret’s line', () => {
    const doc = '![cover](cover.png)\n\nx';
    expect(show(doc, END, 'live').widgets).toEqual(['ImageWidget:![cover](cover.png)']);
    expect(show(doc, 0, 'live').widgets).toEqual([]);
  });

  it('gives the allowed HTML tags their look and hides the tags', () => {
    const shown = show('the <u>merciless</u> work, H<sub>2</sub>O<br>\n\nx', END, 'live');
    expect(shown.marks).toEqual(expect.arrayContaining(['eien-underline:merciless', 'eien-sub:2']));
    expect(shown.hidden).toEqual(['<u>', '</u>', '<sub>', '</sub>', '<br>']);
  });

  it('leaves any other HTML as written text', () => {
    const shown = show('a <script>alert(1)</script> b\n\nx', END, 'live');
    expect(shown.hidden).toEqual([]);
    expect(shown.marks).toEqual([]);
  });

  it('hides a quote’s ">" and rules the line', () => {
    const shown = show('> He drapes it.\n\nx', END, 'live');
    expect(shown.hidden).toEqual(['> ']);
    expect(shown.lines).toContain('eien-quote@1');
  });
});

describe('Live with its marks hidden', () => {
  /** As `show`, with "Show Markdown marks" off. */
  const hidden = (doc: string, caret: number) => {
    const state = EditorState.create({
      doc,
      selection: EditorSelection.cursor(caret),
      extensions: [eienMarkdown(), previewMode.of('live'), showMarks.of(false), livePreview],
    });
    const found: string[] = [];
    state.field(livePreview).between(0, doc.length, (from, to, deco) => {
      if (!(deco.spec as { class?: string }).class) found.push(doc.slice(from, to));
    });
    return found;
  };

  it('keeps the marks hidden on the caret’s line too', () => {
    const doc = '## A **bold** [link](x.md) word';
    expect(show(doc, 8, 'live').hidden).toEqual([]);
    expect(hidden(doc, 8)).toEqual(['## ', '**', '**', '[', '](x.md)']);
  });

  it('keeps a table’s pipes hidden on the caret’s row', () => {
    const doc = '| a | b |\n|---|---|\n| 1 | 2 |';
    expect(hidden(doc, doc.indexOf('1'))).toEqual(['|', '|', '|', '|---|---|', '|', '|', '|']);
  });

  it('shows the marks again when the setting comes back on', () => {
    const doc = 'A **bold** word.';
    const state = EditorState.create({
      doc,
      selection: EditorSelection.cursor(4),
      extensions: [
        eienMarkdown(),
        previewMode.of('live'),
        marks.of(showMarks.of(false)),
        livePreview,
      ],
    });
    const count = (s: EditorState) => s.field(livePreview).size;
    expect(count(state)).toBeGreaterThan(0);
    const back = state.update({ effects: marks.reconfigure([]) }).state;
    expect(count(back)).toBe(0);
  });
});

describe('Reading', () => {
  it('hides every mark, wherever the caret is', () => {
    const doc = 'A **bold** word.';
    expect(show(doc, 3, 'reading').hidden).toEqual(['**', '**']);
  });
});

describe('Source', () => {
  it('draws nothing: the file as it is', () => {
    const shown = show('A **bold** word.\n\n***\n\n- [ ] task', END, null);
    expect(shown).toEqual({ hidden: [], widgets: [], marks: [], lines: [] });
  });
});

describe('the syntax', () => {
  const names = (doc: string) => {
    const state = EditorState.create({ doc, extensions: [eienMarkdown()] });
    const found: string[] = [];
    syntaxTree(state).iterate({ enter: (node) => void found.push(node.name) });
    return found;
  };

  it('reads ==highlight== but not a lone "=" or "==="', () => {
    expect(names('a ==b== c')).toContain('Highlight');
    expect(names('a = b == c')).not.toContain('Highlight');
    expect(names('a ===b=== c')).not.toContain('Highlight');
  });

  it('reads [[wiki links]] on one line, and leaves empty or broken ones alone', () => {
    expect(names('see [[Note]]')).toContain('WikiLink');
    expect(names('see [[ ]]')).not.toContain('WikiLink');
    expect(names('see [[Note\nmore]]')).not.toContain('WikiLink');
    expect(names('see [[Note')).not.toContain('WikiLink');
  });
});
