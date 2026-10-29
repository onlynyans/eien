// A link's tools in Live (backlog #38), on the note's editor: they come with
// the caret, step aside while typing, go with Esc; ⌘K edits, ⌥↩ opens, ⌥F10
// reaches them; the setting swaps the way they're shown, live; and a link's
// words and address reach the window as text. Off a Mac, Mod is Ctrl.

import { undo } from '@codemirror/commands';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { NoteEditor } from './editor';
import type { LinkTarget } from './link-core';
import type { LinkNote } from './link-presenter';
import { NoteDoc } from './note-doc';

const NOTE =
  'See [[Below the Gate|chapter iii]] and [AO3](https://archiveofourown.org/works/1) too.\n\nPlain words.\n';
const NOTES: Record<string, LinkNote> = {
  'Below the Gate': {
    crumbs: 'Fic / Beneath the Walls',
    title: 'Below the Gate',
    preview: 'The water came up through the stones first.',
    words: 3412,
  },
};

let editor: NoteEditor;
let doc: NoteDoc;
let followed: Mock<(target: LinkTarget) => void>;
let said: Mock<(words: string) => void>;

beforeEach(() => {
  followed = vi.fn<(target: LinkTarget) => void>();
  said = vi.fn<(words: string) => void>();
  const host = document.body.appendChild(document.createElement('div'));
  editor = new NoteEditor(host, {
    changed: () => {},
    follow: (target) => followed(target),
    about: (name) => NOTES[name] ?? null,
    said: (words) => said(words),
  });
  document.body.append(editor.links.layer, editor.links.dock);
  doc = new NoteDoc(NOTE);
  editor.show(doc, async () => null);
  // As if the keyboard were in the note: happy-dom's focus fires selectionchange mid-update.
  vi.spyOn(editor.view, 'focus').mockImplementation(() => {});
  vi.spyOn(editor.view, 'hasFocus', 'get').mockReturnValue(true);
});

afterEach(() => {
  editor.destroy();
  document.body.replaceChildren();
});

/** Let the tools settle: they're read once the editor's update is done. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

async function caretAt(words: string): Promise<void> {
  editor.reveal(editor.text.indexOf(words) + 1, editor.text.indexOf(words) + 1);
  await settled();
}

const key = (init: KeyboardEventInit) =>
  editor.view.contentDOM.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
  );

const card = () => document.querySelector<HTMLElement>('.link-card');
const shownCard = () => {
  const element = card();
  return element && !element.hidden ? element : null;
};

describe('the card, the desktop’s way', () => {
  it('comes with the caret in a link, and says which note it opens', async () => {
    await caretAt('chapter');
    const shown = shownCard();
    expect(shown?.getAttribute('aria-label')).toBe('Link to Below the Gate');
    expect(shown?.textContent).toContain('Fic / Beneath the Walls');
    expect(shown?.textContent).toContain('The water came up');
    expect(shown?.textContent).toContain('3,412 WORDS');
    expect(document.querySelector('.link-said')?.textContent).toMatch(/^Link to Below the Gate\./);
  });

  it('shows a web link’s site and the rest of its address', async () => {
    await caretAt('AO3');
    expect(shownCard()?.querySelector('.link-card__site')?.textContent).toBe('archiveofourown.org');
    expect(shownCard()?.querySelector('.link-card__path')?.textContent).toBe('/works/1');
  });

  it('goes when the caret leaves the link, while typing, and with Esc', async () => {
    await caretAt('chapter');
    await caretAt('Plain');
    expect(shownCard()).toBeNull();

    await caretAt('chapter');
    editor.view.dispatch({
      changes: { from: editor.view.state.selection.main.head, insert: 'x' },
      userEvent: 'input.type',
    });
    await settled();
    expect(shownCard()).toBeNull();
    await caretAt('hapter'); // moved: it's back
    expect(shownCard()).not.toBeNull();

    key({ key: 'Escape' });
    await settled();
    expect(shownCard()).toBeNull();
  });

  it('never shows in Source or Reading', async () => {
    for (const mode of ['source', 'reading'] as const) {
      editor.setMode(mode);
      await caretAt('chapter');
      expect(shownCard()).toBeNull();
    }
  });

  it('opens the caret’s link with ⌥↩, and with its Open', async () => {
    await caretAt('AO3');
    key({ key: 'Enter', altKey: true });
    expect(followed).toHaveBeenLastCalledWith({
      kind: 'url',
      value: 'https://archiveofourown.org/works/1',
    });
    shownCard()?.querySelector<HTMLButtonElement>('[aria-label^="Open"]')?.click();
    expect(followed).toHaveBeenCalledTimes(2);
  });

  it('edits the words and where it goes with ⌘K, as one step ⌘Z takes back', async () => {
    await caretAt('AO3');
    key({ key: 'k', ctrlKey: true });
    const fields = shownCard()?.querySelectorAll('input') ?? [];
    expect(fields).toHaveLength(2);
    const [words, goes] = fields as unknown as HTMLInputElement[];
    expect(words?.value).toBe('AO3');
    expect(goes?.value).toBe('https://archiveofourown.org/works/1');
    if (!words || !goes) return;
    words.value = 'the archive';
    goes.value = 'Below the Gate';
    goes.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(editor.text).toContain('[[Below the Gate|the archive]]');
    doc.run(editor.view, undo);
    expect(editor.text).toBe(NOTE);
  });

  it('puts back what was typed with Esc', async () => {
    await caretAt('AO3');
    key({ key: 'k', ctrlKey: true });
    const words = shownCard()?.querySelector('input');
    if (!words) throw new Error('no field');
    words.value = 'nothing kept';
    words.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(editor.text).toBe(NOTE);
  });

  it('takes the link off, the words kept', async () => {
    await caretAt('chapter');
    shownCard()?.querySelector<HTMLButtonElement>('[aria-label^="Take the link off"]')?.click();
    expect(editor.text).toBe(NOTE.replace('[[Below the Gate|chapter iii]]', 'chapter iii'));
  });

  it('changes nothing while the note is held still', async () => {
    await caretAt('AO3');
    key({ key: 'k', ctrlKey: true });
    const words = shownCard()?.querySelector('input');
    if (!words) throw new Error('no field');
    words.value = 'moved meanwhile';
    editor.setLocked(true);
    words.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(editor.text).toBe(NOTE);
  });

  it('says a note not made yet isn’t, rather than opening nothing', async () => {
    editor.view.dispatch({ changes: { from: 0, insert: '[[Nowhere]] ' } });
    await caretAt('Nowhere');
    expect(shownCard()?.textContent).toContain('No note yet');
    shownCard()?.querySelector<HTMLButtonElement>('[aria-label^="Open"]')?.click();
    expect(followed).not.toHaveBeenCalled();
    expect(said).toHaveBeenLastCalledWith('No note called Nowhere yet');
  });

  it('draws a link’s words and address as text, never as markup', async () => {
    editor.view.dispatch({
      changes: { from: 0, insert: '[<img src=x onerror=alert(1)>](https://a.org/<b>x</b>) ' },
    });
    await caretAt('img');
    expect(shownCard()).not.toBeNull();
    expect(document.querySelector('.link-layer img, .link-layer b')).toBeNull();
    key({ key: 'k', ctrlKey: true });
    expect(shownCard()?.querySelector('input')?.value).toBe('<img src=x onerror=alert(1)>');
    expect(document.querySelector('.link-layer img')).toBeNull();
  });
});

describe('the setting, swapped live', () => {
  it('shows the bar in the card’s place, and its field edits where it goes', async () => {
    await caretAt('AO3');
    editor.setLinkStyle('bar');
    await settled();
    expect(shownCard()).toBeNull();
    const bar = document.querySelector<HTMLElement>('.link-bar:not([hidden])');
    expect(bar?.getAttribute('role')).toBe('toolbar');
    expect(bar?.getAttribute('aria-label')).toBe('Link to archiveofourown.org/works/1');
    key({ key: 'k', ctrlKey: true });
    const goes = bar?.querySelector('input');
    if (!goes) throw new Error('no field');
    goes.value = 'https://ao3.org';
    goes.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(editor.text).toContain('[AO3](https://ao3.org)');
  });

  it('opens the link in place, ↗ after it, and says where it goes in the colophon', async () => {
    editor.setLinkStyle('inline');
    await caretAt('AO3');
    expect(said).toHaveBeenLastCalledWith(
      expect.stringMatching(/^→ archiveofourown\.org\/works\/1 ·/),
    );
    const open = editor.view.contentDOM.querySelector<HTMLButtonElement>('.eien-link-open');
    expect(open?.getAttribute('aria-label')).toBe('Open https://archiveofourown.org/works/1');
    // The address is in sight, in the Source font, and the marks with it.
    expect(editor.view.contentDOM.querySelector('.eien-link-address')?.textContent).toBe(
      'https://archiveofourown.org/works/1',
    );
    open?.click();
    expect(followed).toHaveBeenLastCalledWith({
      kind: 'url',
      value: 'https://archiveofourown.org/works/1',
    });
    editor.setLinkStyle('card');
    await settled();
    expect(editor.view.contentDOM.querySelector('.eien-link-open')).toBeNull();
    expect(shownCard()).not.toBeNull();
  });
});
