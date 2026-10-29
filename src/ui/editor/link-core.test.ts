// The link core (backlog #38): a link found at a place in each of its four
// forms, edited as one step the note's history takes back whole, taken off
// with its words kept, and followed where it leads.

import { undo } from '@codemirror/commands';
import { EditorState, type TransactionSpec } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { caretLink, type Link, linkAt, linkEdit, linkOff, targetOf } from './link-core';
import { NoteDoc } from './note-doc';
import { eienMarkdown } from './syntax';

const stateOf = (text: string) => EditorState.create({ doc: text, extensions: [eienMarkdown()] });

/** The link round the first `words` in `text`. */
function at(text: string, words: string): { state: EditorState; link: Link } {
  const state = stateOf(text);
  const link = linkAt(state, text.indexOf(words));
  if (!link) throw new Error(`No link at ${words}`);
  return { state, link };
}

/** `text` after `spec`. */
const edited = (state: EditorState, spec: TransactionSpec | null): string =>
  spec ? state.update(spec).state.doc.toString() : state.doc.toString();

describe('linkAt', () => {
  it('finds a wiki link, its name and its words', () => {
    const { link } = at('See [[What the Recruits Say|chapter iv]] now.', 'chapter');
    expect(link).toMatchObject({
      form: 'wiki',
      kind: 'note',
      words: 'chapter iv',
      goesTo: 'What the Recruits Say',
      from: 4,
      to: 40,
    });
    expect(targetOf(link)).toEqual({ kind: 'note', value: 'What the Recruits Say' });
  });

  it('finds a wiki link whose words are its name', () => {
    const { link } = at('See [[Below the Gate]].', 'Below');
    expect(link).toMatchObject({ words: 'Below the Gate', goesTo: 'Below the Gate' });
    expect(link.wordsAt).toEqual(link.goesAt);
  });

  it('finds a web link, its words and address, from its words or its address', () => {
    const text = 'Read [the **gate**](https://a.org/x "Title") here.';
    for (const where of ['gate', 'a.org']) {
      expect(at(text, where).link).toMatchObject({
        form: 'inline',
        kind: 'web',
        words: 'the **gate**',
        goesTo: 'https://a.org/x',
      });
    }
  });

  it('finds an address in <…> after the words, without its brackets', () => {
    expect(at('[a](<https://a.org/x y>)', 'a]').link.goesTo).toBe('https://a.org/x y');
  });

  it('finds an autolink and a bare address, whose words are the address', () => {
    expect(at('Go <https://a.org> now', 'a.org').link).toMatchObject({
      form: 'angle',
      words: 'https://a.org',
      goesTo: 'https://a.org',
    });
    expect(at('Go https://a.org now', 'a.org').link).toMatchObject({ form: 'bare' });
    expect(targetOf(at('Go www.a.org now', 'a.org').link)).toEqual({
      kind: 'url',
      value: 'https://www.a.org',
    });
  });

  it('finds nothing in plain words, a writer’s [sic], an image or a reference link', () => {
    for (const text of ['plain words', 'he said [sic] so', '![alt](https://a.org/p.png)']) {
      const state = stateOf(text);
      for (let pos = 0; pos <= text.length; pos++) expect(linkAt(state, pos)).toBeNull();
    }
    const ref = '[words][r]\n\n[r]: https://a.org\n';
    expect(linkAt(stateOf(ref), 2)).toBeNull();
  });
});

describe('caretLink', () => {
  const text = 'A [[Note]] and [w](https://a.org) and https://b.org';
  const state = stateOf(text);
  const caret = (pos: number) => caretLink(state, pos)?.goesTo ?? null;

  it('is the link the caret is inside, not one it stands beside', () => {
    expect(caret(text.indexOf('[[Note'))).toBeNull();
    expect(caret(text.indexOf('Note'))).toBe('Note');
    expect(caret(text.indexOf(']]'))).toBe('Note');
    expect(caret(text.indexOf(' and [w'))).toBeNull();
    expect(caret(text.indexOf('w]'))).toBe('https://a.org');
    expect(caret(text.indexOf(') and'))).toBe('https://a.org');
    expect(caret(text.indexOf(') and') + 1)).toBeNull();
  });

  it('keeps a bare address’s end, as it has no closing mark', () => {
    expect(caret(text.length)).toBe('https://b.org');
  });
});

describe('linkEdit', () => {
  it('changes a web link’s words and address in place, keeping its title', () => {
    const text = 'Read [AO3](https://archiveofourown.org "the archive").';
    const { state, link } = at(text, 'AO3');
    const spec = linkEdit(state, link, { words: 'the archive', goesTo: 'https://ao3.org/works/1' });
    expect(edited(state, spec)).toBe('Read [the archive](https://ao3.org/works/1 "the archive").');
  });

  it('leaves the caret at the end of the words, in the link', () => {
    const text = 'Read [AO3](https://a.org).';
    const { state, link } = at(text, 'AO3');
    const next = state.update(linkEdit(state, link, { words: 'the archive' }) ?? {}).state;
    expect(next.selection.main.head).toBe('Read [the archive'.length);
    expect(caretLink(next, next.selection.main.head)?.words).toBe('the archive');
  });

  it('changes nothing when nothing changed', () => {
    const { state, link } = at('[AO3](https://a.org)', 'AO3');
    expect(linkEdit(state, link, { words: 'AO3', goesTo: ' https://a.org ' })).toBeNull();
    expect(linkEdit(state, link, {})).toBeNull();
  });

  it('keeps the address when "goes to" is left empty', () => {
    const { state, link } = at('[AO3](https://a.org)', 'AO3');
    expect(edited(state, linkEdit(state, link, { words: 'x', goesTo: '  ' }))).toBe(
      '[x](https://a.org)',
    );
  });

  it('gives empty words the address, so the link never vanishes', () => {
    const { state, link } = at('[AO3](https://a.org)', 'AO3');
    expect(edited(state, linkEdit(state, link, { words: '' }))).toBe(
      '[https://a.org](https://a.org)',
    );
  });

  it('escapes brackets typed in the words', () => {
    const { state, link } = at('[AO3](https://a.org)', 'AO3');
    expect(edited(state, linkEdit(state, link, { words: 'a [b]' }))).toBe(
      '[a \\[b\\]](https://a.org)',
    );
  });

  it('writes an address with spaces in <…>, and keeps the brackets an address had', () => {
    const { state, link } = at('[a](https://a.org)', 'a]');
    expect(edited(state, linkEdit(state, link, { goesTo: 'https://a.org/x y' }))).toBe(
      '[a](<https://a.org/x y>)',
    );
    const angled = at('[a](<https://a.org/x y>)', 'a]');
    expect(
      edited(angled.state, linkEdit(angled.state, angled.link, { goesTo: 'https://b.org' })),
    ).toBe('[a](https://b.org)');
  });

  it('renames a wiki link’s note, its words following when they were its name', () => {
    const named = at('See [[Below the Gate]].', 'Below');
    expect(edited(named.state, linkEdit(named.state, named.link, { goesTo: 'Rations' }))).toBe(
      'See [[Rations]].',
    );
    const worded = at('See [[Below the Gate|iii]].', 'iii');
    expect(edited(worded.state, linkEdit(worded.state, worded.link, { goesTo: 'Rations' }))).toBe(
      'See [[Rations|iii]].',
    );
    expect(
      edited(worded.state, linkEdit(worded.state, worded.link, { words: 'Below the Gate' })),
    ).toBe('See [[Below the Gate]].');
  });

  it('makes a wiki link a web link when an address is typed, and back', () => {
    const wiki = at('See [[Below the Gate|iii]].', 'iii');
    expect(
      edited(wiki.state, linkEdit(wiki.state, wiki.link, { goesTo: 'fandom.wiki/Gate' })),
    ).toBe('See [iii](https://fandom.wiki/Gate).');
    const web = at('See [the wiki](https://fandom.wiki).', 'the wiki');
    expect(edited(web.state, linkEdit(web.state, web.link, { goesTo: 'Below the Gate' }))).toBe(
      'See [[Below the Gate|the wiki]].',
    );
  });

  it('takes a name the vault has as a note’s, though it reads as an address', () => {
    const { state, link } = at('See [[x]].', 'x');
    const isNote = (name: string) => name === 'notes.md';
    expect(edited(state, linkEdit(state, link, { goesTo: 'notes.md' }, isNote))).toBe(
      'See [[notes.md]].',
    );
    expect(edited(state, linkEdit(state, link, { goesTo: 'notes.md' }))).toBe(
      'See [x](https://notes.md).',
    );
  });

  it('changes a bare address in place, and gives it words as a link', () => {
    const bare = at('Go https://a.org now', 'a.org');
    expect(edited(bare.state, linkEdit(bare.state, bare.link, { goesTo: 'https://b.org' }))).toBe(
      'Go https://b.org now',
    );
    expect(edited(bare.state, linkEdit(bare.state, bare.link, { words: 'A' }))).toBe(
      'Go [A](https://a.org) now',
    );
    const angle = at('Go <https://a.org> now', 'a.org');
    expect(edited(angle.state, linkEdit(angle.state, angle.link, { goesTo: 'b.org' }))).toBe(
      'Go <https://b.org> now',
    );
  });

  it('is one step of the note’s history: one undo puts back the words and the address', () => {
    const text = 'Read [AO3](https://a.org) now.';
    const doc = new NoteDoc(text);
    const { state, link } = at(text, 'AO3');
    const spec = linkEdit(state, link, { words: 'B', goesTo: 'https://b.org' });
    // As the editor's view would send it: the transaction, recorded in the document's history.
    const view = { state, update: () => {} } as never;
    doc.dispatch(view, [state.update(spec ?? {})]);
    expect(doc.text).toBe('Read [B](https://b.org) now.');
    const undone = doc.run({ state: { readOnly: false }, dispatch: () => {} } as never, undo);
    expect(undone).toBe(true);
    expect(doc.text).toBe(text);
  });
});

describe('linkOff', () => {
  it('takes the link off and keeps its words as they read', () => {
    for (const [text, words, kept] of [
      ['See [[Below the Gate|iii]] now', 'iii', 'See iii now'],
      ['See [[Below the Gate]] now', 'Below', 'See Below the Gate now'],
      ['See [the **gate**](https://a.org) now', 'gate', 'See the **gate** now'],
    ] as const) {
      const { state, link } = at(text, words);
      expect(edited(state, linkOff(link))).toBe(kept);
    }
  });

  it('leaves an address that is its own words, which would still be a link', () => {
    expect(linkOff(at('See <https://a.org> now', 'a.org').link)).toBeNull();
    expect(linkOff(at('See https://a.org now', 'a.org').link)).toBeNull();
  });
});
