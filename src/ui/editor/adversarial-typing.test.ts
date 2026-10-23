// Adversarial tests for phase 8 in the editor: quotes typed one key at a
// time, pastes decided on the editor's state, and Copy as HTML of what's
// chosen. Each was written to break the code, and each comment says the
// defect it caught (as it was, before the fix) and why a writer would care;
// the rest pin what matters.

import { ensureSyntaxTree } from '@codemirror/language';
import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it, vi } from 'vitest';
import { nameKey } from '../../core/paths';
import { htmlCopy } from '../vault/copy-html';
import { eienMarkdown } from './syntax';
import { pastedText, typedText } from './typing';

/** `doc` with the caret where "|" is (removed), parsed. */
function at(marked: string): { state: EditorState; pos: number } {
  const pos = marked.indexOf('|');
  const doc = marked.slice(0, pos) + marked.slice(pos + 1);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(pos),
    extensions: [eienMarkdown()],
  });
  ensureSyntaxTree(state, doc.length, 5_000);
  return { state, pos };
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

describe('typing quotes: what a writer gets', () => {
  it('dialogue, nested quotes, elisions, years and possessives', () => {
    expect(typing('|', '"\'Hey,\' he said," she said.')).toBe('“‘Hey,’ he said,” she said.');
    expect(typing('|', "'Tis the '90s, rock 'n' roll, the boys' toys.")).toBe(
      '’Tis the ’90s, rock ’n’ roll, the boys’ toys.',
    );
    expect(typing('|', '"Wait..." he said. "Well…" she said.')).toBe(
      '“Wait...” he said. “Well…” she said.',
    );
    expect(typing('|', 'He turned—"Stop!"')).toBe('He turned—“Stop!”');
    expect(typing('|', '*"Hi,"* he said, <u>"twice"</u>.')).toBe(
      '*“Hi,”* he said, <u>“twice”</u>.',
    );
  });

  it('leaves other languages’ marks alone', () => {
    expect(typing('|', '« Bonjour » et „Hallo“ und »Ja«')).toBe('« Bonjour » et „Hallo“ und »Ja«');
  });

  it('stays straight in front matter, code, an address and a tag’s attributes', () => {
    expect(typing('---\ntitle: |\n---\nBody', 'Don\'t "x"')).toBe(
      '---\ntitle: Don\'t "x"\n---\nBody',
    );
    expect(typing('|', 'Run `say "hi"` now')).toBe('Run `say "hi"` now');
    expect(typing('|', 'See <https://x.org/?q="a"> now')).toBe('See <https://x.org/?q="a"> now');
    expect(typing('|', '<span title="x">')).toBe('<span title="x">');
  });

  // A closing quote after a dash curls open: typing "Wait—" he said. gives “Wait—“ he said.
  // Interrupted dialogue is common in fiction, and the space typed after the quote shows it closed
  // (as elidedOpen already fixes "‘tis" once the word ends).
  it('closes a quote typed after an interrupting dash', () => {
    expect(typing('|', '"Wait—" he said.')).toBe('“Wait—” he said.');
    expect(typing('|', '"I can\'t—" She stopped.')).toBe('“I can’t—” She stopped.');
  });

  // A quote typed after an entity is read as closing: &nbsp;"Hi" gives &nbsp;”Hi”, both backwards.
  it('opens a quote typed after a space written as an entity', () => {
    expect(typing('|', '&nbsp;"Hi," she said.')).toBe('&nbsp;“Hi,” she said.');
  });

  // An escaped quote ("\"", the writer asking for a straight one) is curled anyway, and "\”"
  // shows its backslash on the page, since "”" can't be escaped.
  it('leaves a quote typed after a backslash straight', () => {
    expect(typing('|', 'a \\"b\\"')).toBe('a \\"b\\"');
  });

  // An apostrophe typed in a [[wiki link]] curls: [[Don't Go]] becomes [[Don’t Go]], which no
  // longer names the note "Don't Go" (titles are compared by nameKey, which keeps ’ and ' apart),
  // so ⌘-click opens nothing.
  it('types a wiki link that still names its note', () => {
    const doc = typing('|', "[[Don't Go]]");
    const title = doc.slice(2, -2).split('|')[0]?.trim() ?? '';
    expect(nameKey(title)).toBe(nameKey("Don't Go"));
  });

  // A link's title typed in quotes curls them: [a](https://x.org “Title”) is no link at all
  // (CommonMark titles take straight quotes), so the brackets show and the address is lost.
  it('types a link’s title in the quotes Markdown needs', () => {
    expect(typing('|', '[a](https://x.org "Title") and')).toBe('[a](https://x.org "Title") and');
  });
});

describe('pasting into the editor', () => {
  it('pastes into the front matter or code as plain text', () => {
    expect(pastedText(at('---\ntitle: |\n---\nBody').state, '<p><em>X</em></p>', 'X')).toBeNull();
    expect(pastedText(at('a `co|de` b').state, '<p><em>X</em></p>', 'X')).toBeNull();
  });

  it('pastes a story site’s HTML as Markdown, words and marks kept', () => {
    expect(
      pastedText(
        at('Note |').state,
        '<p>“Look,” he said, <em>and</em> stopped.</p><p><br /></p><hr /><p><br /></p><p>Done.</p>',
        'x',
      ),
    ).toBe('“Look,” he said, *and* stopped.\n\n***\n\nDone.');
  });
});

/** Copy as HTML with `selection` chosen in `doc`: what reaches the clipboard. */
async function copied(
  doc: string,
  selection: { anchor: number; head?: number },
): Promise<string | undefined> {
  const state = EditorState.create({ doc, selection });
  const copy = vi.fn(async (_text: string, _html: string) => {});
  const out = htmlCopy({
    active: () =>
      ({
        page: { editor: { view: { state } } },
        note: { session: { text: doc, path: 'Chapter.md' } },
      }) as never,
    out: { kinds: ['html'], copy, saveAs: vi.fn(async () => null) },
    settings: { values: { 'typography.quotes': 'curly', 'html.sceneBreak': 'rule' } } as never,
    tell: () => {},
  });
  await out.copy();
  return copy.mock.calls[0]?.[1];
}

describe('Copy as HTML of the open note', () => {
  it('leaves the front matter out, of the whole note or a choice that starts in it', async () => {
    const doc = '---\ntitle: Secret\n---\n"Body," she said.';
    expect(await copied(doc, { anchor: 0 })).toBe('<p>“Body,” she said.</p>');
    expect(await copied(doc, { anchor: 4, head: doc.length })).toBe('<p>“Body,” she said.</p>');
  });

  // A choice that starts at a "---" scene break is read as starting with front matter: everything
  // up to the next "---" is left out, and the toast still says "Copied what’s chosen as HTML."
  it('copies every word of a choice that starts at a --- scene break', async () => {
    const doc = 'Scene one.\n\n---\n\nScene two, kept.\n\n---\n\nScene three.';
    const from = doc.indexOf('---');
    expect(await copied(doc, { anchor: from, head: doc.length })).toContain('Scene two, kept.');
  });
});
