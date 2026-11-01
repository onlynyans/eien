// Adversarial tests for phase 9a's writing tools (spec §4, §6): the scene
// break Enter makes, the paragraph focus mode keeps bright, the changes
// typewriter scrolling brings to the middle, and the settings behind them.
// Each "defect" comment says what was wrong, as it was before the fix, and
// why a writer would care; the rest pin what matters.
//
// Enter is pressed as the editor binds it: the Markdown keymap's Enter first
// (lang-markdown adds it at Prec.high), then the scene break, then
// CodeMirror's own newline.

import { history, insertNewlineAndIndent, redo, undo } from '@codemirror/commands';
import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import {
  EditorSelection,
  EditorState,
  type Extension,
  type SelectionRange,
  type StateCommand,
  type Transaction,
  type TransactionSpec,
} from '@codemirror/state';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { readSettings, SETTINGS, TOGGLES, valueProblem, withDefaults } from '../../core/config';
import { frontMatterEnd } from '../../core/text';
import { frontMatterHidden } from './front-matter-hidden';
import { livePreview, previewMode } from './live-preview';
import { eienMarkdown } from './syntax';
import { SceneBreakWidget } from './widgets';
import { currentParagraph, sceneBreakAt, typewriter } from './writing-tools';

/** Where the caret is in a marked note ("|" is a table's, so not that). */
const CARET = '‸';

/** Live, as the editor sets it up: the id-only front matter kept out of sight and whole. */
const LIVE: Extension = [previewMode.of('live'), livePreview, frontMatterHidden];

/** `marked` with the caret at "‸" (removed), parsed. */
function at(marked: string, extensions: Extension = []): EditorState {
  const pos = marked.indexOf(CARET);
  const doc = marked.slice(0, pos) + marked.slice(pos + 1);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(pos),
    extensions: [eienMarkdown(), extensions],
  });
  ensureSyntaxTree(state, doc.length, 5_000);
  return state;
}

/** Run a command on `state`; the state after, or null when it declined. */
function run(command: StateCommand, state: EditorState): EditorState | null {
  let after: EditorState | null = null;
  const ran = command({
    state,
    dispatch: (tr: Transaction) => {
      after = tr.state;
    },
  });
  return ran ? after : null;
}

/** Enter, as the editor's keymaps take it. */
function press(state: EditorState): EditorState {
  const continued = run(insertNewlineContinueMarkup, state);
  if (continued) return continued;
  const spec = sceneBreakAt(state);
  if (spec) return state.update(spec).state;
  return run(insertNewlineAndIndent, state) ?? state;
}

const shown = (state: EditorState) => {
  const caret = state.selection.main.head;
  return `${state.doc.sliceString(0, caret)}${CARET}${state.doc.sliceString(caret)}`;
};

/** The note after Enter at "‸". */
const enter = (marked: string, extensions: Extension = []) => shown(press(at(marked, extensions)));

/** The lines Live draws as a centered "* * *". */
function drawnAsSceneBreaks(state: EditorState): string[] {
  const out: string[] = [];
  state.field(livePreview).between(0, state.doc.length, (from, to, deco) => {
    if (deco.spec.widget instanceof SceneBreakWidget) out.push(state.doc.sliceString(from, to));
  });
  return out;
}

describe('scene break: defects', () => {
  it('is never put at the start of the writing, after the front matter', () => {
    // Defect: sceneBreakAt counts back over blank lines to the note's first line, so front
    // matter counts as writing. Two Enters at the top of an empty sealed note (its id-only
    // front matter hidden in Live) put "***" first on the page; the same keys in a note never
    // sealed do nothing of the kind. A chapter shouldn't open with a scene break.
    const sealed = '---\nid: CSHE541J35\n---\n';
    expect(shown(press(press(at(CARET, LIVE))))).toBe(`\n\n${CARET}`); // unsealed: no scene break
    expect.soft(shown(press(press(at(`${sealed}${CARET}`, LIVE))))).toBe(`${sealed}\n\n${CARET}`);
    // Front matter the writer wrote is no more the writing than Eien's own.
    expect
      .soft(enter(`---\ntitle: Mending\n---\n\n${CARET}`))
      .toBe(`---\ntitle: Mending\n---\n\n\n${CARET}`);
  });

  it('is not made right after a scene break written another way', () => {
    // Defect: only a line reading "***" counts as a scene break before the caret, though Live
    // draws "* * *", "---", "___", "- - -", "*****" and <hr> as the same centered break. A
    // manuscript from Word or another app ("* * *" is the usual mark) gets a second break
    // straight after the first: two in a row on the page.
    for (const mark of ['* * *', '---', '___', '- - -', '*****', '<hr>']) {
      const before = `She left.\n\n${mark}\n\n${CARET}`;
      expect(drawnAsSceneBreaks(at(before, LIVE))).toEqual([mark]); // Live shows it as one
      expect.soft(enter(before), mark).toBe(`She left.\n\n${mark}\n\n\n${CARET}`);
    }
  });

  it('is never put inside a raw HTML block, where "***" is only text', () => {
    // Defect: isLiteralAt doesn't count an HTMLBlock as literal, and <pre>, <script>,
    // <style> and <textarea> blocks run on across blank lines. Enter there types a "***" that
    // no view draws as a scene break: three stars of literal text in what the writer set
    // aside as preformatted.
    for (const tag of ['pre', 'script', 'style', 'textarea']) {
      const marked = `<${tag}>\nShe left.\n\n${CARET}\n</${tag}>`;
      const after = press(at(marked, LIVE));
      expect(drawnAsSceneBreaks(after), tag).toEqual([]);
      // Enter's own newline (CodeMirror may indent it, as HTML's lines are).
      expect(shown(after), tag).toMatch(
        new RegExp(`^<${tag}>\\nShe left\\.\\n\\n\\n[ \\t]*${CARET}\\n</${tag}>$`, 'u'),
      );
    }
  });
});

describe('scene break: what holds', () => {
  it('one ⌘Z takes back the scene break alone, and redo puts it back', () => {
    let state = at(`She left.${CARET}`, history());
    state = press(press(press(state)));
    expect(shown(state)).toBe(`She left.\n\n***\n\n${CARET}`);
    const undone = run(undo, state);
    expect(undone && shown(undone)).toBe(`She left.\n\n${CARET}`);
    const redone = undone && run(redo, undone);
    expect(redone && shown(redone)).toBe(`She left.\n\n***\n\n${CARET}`);
  });

  it('not in code being written, an HTML comment, or code that runs across blank lines', () => {
    expect(enter(`\`\`\`\nlet x = 1\n\n${CARET}`)).toBe(`\`\`\`\nlet x = 1\n\n\n${CARET}`);
    expect(enter(`~~~\nx\n\n${CARET}\n~~~`)).toBe(`~~~\nx\n\n\n${CARET}\n~~~`);
    expect(enter(`    a\n\n${CARET}\n    b`)).toBe(`    a\n\n\n${CARET}\n    b`);
    expect(enter(`<!--\nnote\n\n${CARET}\n-->`)).toBe(`<!--\nnote\n\n\n${CARET}\n-->`);
  });

  it('not with several carets, and not inside a quote, where Markdown’s Enter comes first', () => {
    const state = EditorState.create({
      doc: 'One.\n\n\n\nTwo.\n\n',
      // Line 3 and line 7: each an empty line after an empty line after words.
      selection: EditorSelection.create([EditorSelection.cursor(6), EditorSelection.cursor(14)]),
      extensions: [eienMarkdown(), EditorState.allowMultipleSelections.of(true)],
    });
    expect(state.selection.ranges).toHaveLength(2);
    expect(sceneBreakAt(state)).toBeNull();
    expect(enter(`> One.\n>\n> ${CARET}`)).not.toContain('***');
  });

  it('after a table, a list or a quote, past the blank lines that end them', () => {
    expect(enter(`| a | b |\n|---|---|\n| 1 | 2 |\n\n${CARET}`)).toBe(
      `| a | b |\n|---|---|\n| 1 | 2 |\n\n***\n\n${CARET}`,
    );
    expect(enter(`- one\n\n${CARET}`)).toBe(`- one\n\n***\n\n${CARET}`);
    expect(enter(`> One.\n\n${CARET}`)).toBe(`> One.\n\n***\n\n${CARET}`);
  });

  it('never loses a word: only a blank line is replaced, and never in front matter or after "***"', () => {
    const line = fc.constantFrom(
      'She left.',
      '',
      '  ',
      '\t',
      '***',
      '```',
      '---',
      '- item',
      '> quote',
      '# Head',
      '    code',
      '<pre>',
      'id: x',
    );
    const strip = (text: string) => text.replace(/\s/g, '');
    fc.assert(
      fc.property(fc.array(line, { minLength: 1, maxLength: 12 }), fc.nat(), (lines, pick) => {
        const doc = lines.join('\n');
        const n = (pick % lines.length) + 1;
        const state = EditorState.create({
          doc,
          selection: { anchor: EditorState.create({ doc }).doc.line(n).from },
          extensions: eienMarkdown(),
        });
        ensureSyntaxTree(state, doc.length, 5_000);
        const spec = sceneBreakAt(state);
        if (!spec) return;
        const caretLine = state.doc.lineAt(state.selection.main.head);
        const next = state.update(spec).state.doc.toString();
        expect(strip(next)).toBe(
          `${strip(doc.slice(0, caretLine.from))}***${strip(doc.slice(caretLine.to))}`,
        );
        expect(caretLine.from).toBeGreaterThanOrEqual(frontMatterEnd(doc));
        let before = caretLine.number - 1;
        while (before > 0 && state.doc.line(before).text.trim() === '') before--;
        expect(before).toBeGreaterThan(0);
        expect(state.doc.line(before).text.trim()).not.toBe('***');
      }),
    );
  });
});

/** The lines focus mode keeps bright, by number. */
function bright(state: EditorState): number[] {
  const lines: number[] = [];
  currentParagraph(state).between(0, state.doc.length, (from) => {
    lines.push(state.doc.lineAt(from).number);
  });
  return lines;
}

describe('focus mode: what holds', () => {
  it('the bright lines are the caret’s, run on to a blank line or the note’s edge either side', () => {
    const line = fc.constantFrom('Words.', '', ' ', '> q', '- i', '***', '\t');
    fc.assert(
      fc.property(fc.array(line, { minLength: 1, maxLength: 15 }), fc.nat(), (lines, pick) => {
        const doc = lines.join('\n');
        const n = (pick % lines.length) + 1;
        const state = EditorState.create({ doc });
        const caret = state.update({ selection: { anchor: state.doc.line(n).from } }).state;
        const lit = bright(caret);
        const blank = (k: number) => caret.doc.line(k).text.trim() === '';
        expect(lit).toContain(n);
        expect(lit).toEqual(Array.from({ length: lit.length }, (_, i) => (lit[0] ?? 0) + i));
        if (blank(n)) expect(lit).toEqual([n]);
        else {
          expect(lit.every((k) => !blank(k))).toBe(true);
          const first = lit[0] ?? 1;
          const last = lit[lit.length - 1] ?? 1;
          expect(first === 1 || blank(first - 1)).toBe(true);
          expect(last === caret.doc.lines || blank(last + 1)).toBe(true);
        }
      }),
    );
  });

  it('a 1 MB note with no blank lines: a keystroke looks at a bounded paragraph, not the note', () => {
    const doc = Array.from({ length: 20_000 }, (_, i) => `Line ${i} of a note with no breaks.`)
      .join('\n')
      .padEnd(1_000_000, 'x');
    const state = EditorState.create({ doc, selection: { anchor: doc.length >> 1 } });
    const lit = bright(state);
    expect(lit.length).toBeLessThanOrEqual(4001);
    expect(lit).toContain(state.doc.lineAt(doc.length >> 1).number);
    // The work counted, not the clock: about a millisecond, but coverage's counters make it six
    // times that, and a busy runner more (50 ms on CI's, 2026-11-01). Each line lit is looked at
    // twice, walking to the paragraph's edge and marking it; none past them, and the note's
    // text never read whole.
    const line = vi.spyOn(state.doc, 'line');
    const lineAt = vi.spyOn(state.doc, 'lineAt');
    const whole = (['toString', 'sliceString', 'iter', 'iterLines', 'iterRange'] as const).map(
      (method) => vi.spyOn(state.doc, method),
    );
    currentParagraph(state);
    expect(line.mock.calls.length + lineAt.mock.calls.length).toBeLessThanOrEqual(
      2 * lit.length + 4,
    );
    for (const method of whole) expect(method).not.toHaveBeenCalled();
  });

  it('follows the text as it changes when the caret doesn’t move', () => {
    const before = at(`One.\n\nTw${CARET}o.`);
    expect(bright(before)).toEqual([3]);
    // The blank line between them taken out elsewhere (another device's change): one paragraph now.
    const joined = before.update({ changes: { from: 4, to: 5 } }).state;
    expect(bright(joined)).toEqual([1, 2]);
  });
});

/** Whether typewriter scrolling brings the caret's line to the middle after `spec`. */
function scrolls(spec: TransactionSpec, doc = 'One.\nTwo.\nThree.'): boolean {
  const state = EditorState.create({ doc, extensions: [typewriter] });
  return state.update(spec).effects.length > 0;
}

describe('typewriter scrolling: defects', () => {
  it('a drop of text with the mouse leaves the page where it is', () => {
    // Defect: CodeMirror marks text dragged in from another app "input.drop", which counts as
    // typing, so the page jumps to put the drop at the middle; text dragged within the note
    // ("move.drop") doesn't move the page. A drop is the mouse's, like a click (spec §4: "a click
    // leaves the page where it is"), and the writer's eye is where they let go.
    expect(scrolls({ changes: { from: 0, insert: 'x' }, userEvent: 'move.drop' })).toBe(false);
    expect(
      scrolls({
        changes: { from: 5, insert: 'Dropped. ' },
        selection: { anchor: 5, head: 14 },
        userEvent: 'input.drop',
      }),
    ).toBe(false);
  });
});

describe('typewriter scrolling: what holds', () => {
  it('keys: typing, a paste, composing, a scene break, a selection by keys', () => {
    expect(scrolls({ changes: { from: 0, insert: 'x' }, userEvent: 'input.paste' })).toBe(true);
    expect(scrolls({ changes: { from: 0, insert: 'か' }, userEvent: 'input.type.compose' })).toBe(
      true,
    );
    expect(scrolls({ changes: { from: 0, insert: '***\n\n' }, userEvent: 'input' })).toBe(true);
    expect(scrolls({ selection: { anchor: 9 }, userEvent: 'select' })).toBe(true);
  });

  it('not choosing words: ⌘A would send the page to the note’s end', () => {
    expect(scrolls({ selection: { anchor: 0, head: 9 }, userEvent: 'select' })).toBe(false);
  });

  it('none of Eien’s own changes: a seal’s id, a reload, a ticked box', () => {
    const seal = EditorState.create({ doc: 'One.', extensions: [typewriter] }).update({
      changes: { from: 0, insert: '---\nid: X\n---\n' },
    });
    expect(seal.effects).toEqual([]);
    expect(scrolls({ changes: { from: 0, to: 4, insert: 'Other.' } })).toBe(false);
  });

  it('the main caret’s line, when there are several', () => {
    const state = EditorState.create({
      doc: 'One.\nTwo.\nThree.',
      extensions: [typewriter, EditorState.allowMultipleSelections.of(true)],
    });
    const tr = state.update({
      selection: EditorSelection.create([EditorSelection.cursor(1), EditorSelection.cursor(12)], 1),
      userEvent: 'select',
    });
    const target = (tr.effects[0]?.value as { range: SelectionRange } | undefined)?.range;
    expect(target?.head).toBe(12);
  });
});

describe('settings for the tools: what holds', () => {
  it('every menu toggle is a device setting of off and on, off by default but the marks', () => {
    for (const key of TOGGLES) {
      const setting = SETTINGS.find((each) => each.key === key);
      expect(setting?.type, key).toBe('choice');
      expect(setting?.scope, key).toBe('device');
      expect(setting && 'choices' in setting && Object.keys(setting.choices).sort(), key).toEqual([
        'off',
        'on',
      ]);
      // Live's marks show as they always have until the writer hides them.
      expect(setting?.default, key).toBe(key === 'editor.marks' ? 'on' : 'off');
    }
  });

  it('a bad value in settings.json is ignored with a warning, and the tool stays off', () => {
    for (const bad of [true, 'On', 'yes', 1, null, ['on']]) {
      const read = readSettings({ 'editor.focus': bad, 'editor.typewriter': bad }, 'device');
      expect(read.values).toEqual({});
      expect(read.problems).toHaveLength(2);
      const values = withDefaults(read.values);
      expect([values['editor.focus'], values['editor.typewriter']]).toEqual(['off', 'off']);
    }
    const setting = SETTINGS.find((each) => each.key === 'editor.focus');
    expect(setting && valueProblem(setting, 'on')).toBeNull();
  });

  it('a vault’s config can’t turn a device’s tools on', () => {
    const read = readSettings({ 'editor.focus': 'on' }, 'vault');
    expect(read.values).toEqual({});
    expect(read.problems[0]).toMatch(/each device/);
  });
});
