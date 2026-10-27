// Typed quotes and pastes, decided on the editor's state alone.

import { ensureSyntaxTree } from '@codemirror/language';
import { EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { GOOGLE_ANSWER, SUBLIME_COPY_AS_HTML } from '../../../tests/support/clipboards';
import { eienMarkdown } from './syntax';
import { isLiteralAt, pastedText, typedText } from './typing';

/** `doc` with the caret where "|" is (removed), parsed. */
function at(marked: string, readOnly = false): { state: EditorState; pos: number } {
  const pos = marked.indexOf('|');
  const doc = marked.slice(0, pos) + marked.slice(pos + 1);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(pos),
    extensions: [eienMarkdown(), EditorState.readOnly.of(readOnly)],
  });
  ensureSyntaxTree(state, doc.length, 5_000);
  return { state, pos };
}

/** What typing `quote` at "|" in `marked` puts there. */
function typed(marked: string, quote = '"'): string | null {
  const { state, pos } = at(marked);
  const spec: TransactionSpec | null = typedText(state, pos, pos, quote, 'curly');
  if (!spec) return null;
  const changes = spec.changes as { from: number; insert: string }[];
  return (changes.find((change) => change.from === pos) ?? changes[0])?.insert ?? null;
}

/** The note after typing `keys` one by one at "|" in `marked`, as the editor would. */
function typing(marked: string, keys: string): string {
  let { state } = at(marked);
  for (const key of keys) {
    const { from, to } = state.selection.main;
    const spec = typedText(state, from, to, key, 'curly') ?? {
      changes: { from, to, insert: key },
      selection: { anchor: from + key.length },
    };
    state = state.update(spec).state;
    ensureSyntaxTree(state, state.doc.length, 5_000);
  }
  return state.doc.toString();
}

describe('typedText', () => {
  it('opens at a line’s start, after a space, a bracket or a dash; closes after a word', () => {
    expect(typed('|')).toBe('“');
    expect(typed('He said |')).toBe('“');
    expect(typed('(|')).toBe('“');
    expect(typed('—|No')).toBe('“');
    expect(typed('—|')).toBe('”'); // until words follow it: interrupted speech
    expect(typed('Hello|')).toBe('”');
    expect(typed('Hello.|')).toBe('”');
    expect(typed('One.\n|')).toBe('“');
  });

  it('makes an apostrophe of a quote in a word, before a year and in an elision', () => {
    expect(typed('don|t', "'")).toBe('’');
    expect(typed('the |90s', "'")).toBe('’');
    expect(typed('|tis', "'")).toBe('’');
    expect(typed('He said |', "'")).toBe('‘');
  });

  it('looks past emphasis marks and opening tags to the words before them', () => {
    expect(typed('*|')).toBe('“');
    expect(typed('He said **|')).toBe('“');
    expect(typed('word*|')).toBe('”');
    expect(typed('*Hi,*|')).toBe('”');
    expect(typed('<u>|')).toBe('“');
    expect(typed('<u>Hi</u>|')).toBe('”');
  });

  it('opens after a quote block’s mark, with or without its space', () => {
    expect(typed('> |')).toBe('“');
    expect(typed('>|')).toBe('“');
    expect(typed('> > |')).toBe('“');
    expect(typed('- |')).toBe('“');
  });

  it('as a writer types: years and elisions end as apostrophes, once they show', () => {
    expect(typing('|', "'Tis the '90s, 'cause 'em. Rock 'n' roll.")).toBe(
      '’Tis the ’90s, ’cause ’em. Rock ’n’ roll.',
    );
    expect(typing('|', "He said 'hello' and 'Tis' no.")).toBe('He said ‘hello’ and ’Tis’ no.');
    expect(typing('|', '"Look," he said. "No."')).toBe('“Look,” he said. “No.”');
    expect(typing('|', "'S fine.")).toBe('’S fine.');
  });

  it('as a writer types dialogue after a dash: it closes, or opens when words follow', () => {
    expect(typing('|', 'She stopped—"No," and "I was—" he said.')).toBe(
      'She stopped—“No,” and “I was—” he said.',
    );
    expect(typing('|', "either/'or' and 'Wait—' then")).toBe('either/‘or’ and ‘Wait—’ then');
  });

  it('after a comment on its line, quotes are prose again', () => {
    expect(typing('<!-- note -->|', ' "Hi"')).toBe('<!-- note --> “Hi”');
    expect(typing('<!-- note |', '"x"')).toBe('<!-- note "x"');
  });

  it('as a writer types code: quotes in it stay straight, even before it’s closed', () => {
    expect(typing('|', 'Run `say "hi"` now, "ok"')).toBe('Run `say "hi"` now, “ok”');
    expect(typing('|', 'Two ``a ` "b"`` then "c"')).toBe('Two ``a ` "b"`` then “c”');
    expect(typing('|', 'Not \\` code "x"')).toBe('Not \\` code “x”');
    expect(typing('```\n|\n```', 'x = "y"')).toBe('```\nx = "y"\n```');
    expect(typing('|', "`it's`")).toBe("`it's`");
  });

  it('types a quote over a selection, and the caret goes after it', () => {
    const { state } = at('He said |word');
    const spec = typedText(state, 8, 12, '"', 'curly') as TransactionSpec;
    expect(spec.changes).toEqual([{ from: 8, to: 12, insert: '“' }]);
    expect(spec.selection).toEqual({ anchor: 9 });
  });

  it('leaves the quote straight when the setting is straight, the note is read-only, or it isn’t a quote', () => {
    const { state, pos } = at('He said |');
    expect(typedText(state, pos, pos, '"', 'straight')).toBeNull();
    expect(typedText(state, pos, pos, 'a', 'curly')).toBeNull();
    expect(typedText(state, pos, pos, '""', 'curly')).toBeNull();
    const locked = at('He said |', true);
    expect(typedText(locked.state, locked.pos, locked.pos, '"', 'curly')).toBeNull();
  });
});

describe('isLiteralAt: where a quote stays as typed', () => {
  const literal = (marked: string) => {
    const { state, pos } = at(marked);
    return isLiteralAt(state, pos);
  };

  it('in code, inline or fenced, closed or not', () => {
    expect(literal('a `co|de` b')).toBe(true);
    expect(literal('a `|code` b')).toBe(true);
    expect(literal('a `code|` b')).toBe(true);
    expect(literal('```\nlet x = |\n```')).toBe(true);
    expect(literal('```\nlet x = |')).toBe(true);
    expect(literal('    indented |code')).toBe(true);
  });

  it('but not just past inline code, or before it', () => {
    expect(literal('a `code`|')).toBe(false);
    expect(literal('a `code`| b')).toBe(false);
    expect(literal('a |`code`')).toBe(false);
    expect(literal('a ` code being typed|')).toBe(true); // until its backtick closes it
  });

  it('in an address, a tag and the front matter; not just past a tag', () => {
    expect(literal('[a](https://x.org/|path)')).toBe(true);
    expect(literal('<https://x.org/|>')).toBe(true);
    expect(literal('<span title="a|b">x</span>')).toBe(true);
    expect(literal('a <span title=|')).toBe(true);
    expect(literal('<div class=|')).toBe(true);
    expect(literal('<div>\nWords |\n</div>')).toBe(false);
    expect(literal('<!--\na comment |\n-->')).toBe(true);
    expect(literal('<u>|x</u>')).toBe(false);
    expect(literal('---\ntitle: |\n---\nBody')).toBe(true);
    expect(literal('---\ntitle: x\n---\n|Body')).toBe(false);
    expect(literal('Plain |words')).toBe(false);
  });

  it('and typedText follows it', () => {
    expect(typed('a `co|de`')).toBeNull();
    expect(typed('a `code` |')).toBe('“');
    expect(typed('a `code`|')).toBe('”');
  });
});

describe('pastedText', () => {
  it('pastes HTML as Markdown, and plain text as it is', () => {
    const { state } = at('Note |');
    expect(pastedText(state, '<p><em>Hi</em></p><p>There</p>', 'Hi\nThere')).toBe('*Hi*\n\nThere');
    expect(pastedText(state, '', 'plain *words*')).toBeNull();
    expect(pastedText(state, '', '<p>A</p><p>B</p>')).toBe('A\n\nB');
  });

  it('keeps later lines of a paste in the quote or list item it goes into', () => {
    const html = '<p>One.</p><p>Two.</p>';
    expect(pastedText(at('> Said |').state, html, 'One.\nTwo.')).toBe('One.\n>\n> Two.');
    expect(pastedText(at('> > |').state, html, 'x')).toBe('One.\n> >\n> > Two.');
    expect(pastedText(at('- Item |').state, html, 'x')).toBe('One.\n\n  Two.');
    expect(pastedText(at('12. Item |').state, html, 'x')).toBe('One.\n\n    Two.');
    expect(pastedText(at('Plain |').state, html, 'x')).toBe('One.\n\nTwo.');
    expect(pastedText(at('|> quote').state, html, 'x')).toBe('One.\n\nTwo.'); // before its mark
  });

  it('pastes a page’s brackets as written, and an editor’s styled copy as typed', () => {
    const { state } = at('Note |');
    expect(pastedText(state, GOOGLE_ANSWER.html, GOOGLE_ANSWER.text)).toContain(
      'technical tools. [[1](https://www.geeksforgeeks.org/software-engineering/difference-between-ci-cd-and-devops/)]',
    );
    const sublime = pastedText(
      at('> |').state,
      SUBLIME_COPY_AS_HTML.html,
      SUBLIME_COPY_AS_HTML.text,
    );
    expect(sublime).toBe(
      '# Notes\n>\n> See [[1](https://example.com/a), [2](https://example.com/b)] and *this*.\n>\n> - a ~~b~~ <kbd>x</kbd> ^2^\n>',
    );
  });

  it('pastes into code, or into a read-only note, as it is', () => {
    const code = at('```\n|\n```');
    expect(pastedText(code.state, '<p><em>Hi</em></p>', 'Hi')).toBeNull();
    const locked = at('Note |', true);
    expect(pastedText(locked.state, '<p><em>Hi</em></p>', 'Hi')).toBeNull();
  });
});
