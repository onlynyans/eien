// The open note's tags on its page (backlog #13): read from the editor's
// text, changed in front matter alone as Eien's quiet edit, and a tag typed
// in the words shown once the typing pauses.

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { NoteEditor } from '../editor/editor';
import { PageTags } from './page-tags';

const NOTE = '---\ntags: [draft]\n---\nA scene. #wip\n';

let changed: Mock<(text: string, written: boolean) => void>;
let tell: Mock<(message: string) => void>;
let editable = true;
let editor: NoteEditor;
let tags: PageTags;
let page: HTMLElement;

beforeEach(() => {
  changed = vi.fn<(text: string, written: boolean) => void>();
  tell = vi.fn<(message: string) => void>();
  editable = true;
  page = document.createElement('div');
  document.body.append(page);
  editor = new NoteEditor(page.appendChild(document.createElement('div')), {
    changed: (text, written) => changed(text, written),
    follow: () => {},
  });
  editor.setText(NOTE, async () => null);
  tags = new PageTags(editor, {
    choices: () => [{ tag: 'posted', count: 1 }],
    editable: () => editable,
    tell: (message) => tell(message),
  });
  tags.listen(page);
  page.append(tags.set.element);
  tags.show(NOTE);
});

afterEach(() => {
  vi.useRealTimers();
  editor.view.destroy();
  document.body.replaceChildren();
});

const shown = () => [...tags.set.element.querySelectorAll('.tag')].map((tag) => tag.textContent);
const offButton = (tag: string) =>
  tags.set.element.querySelector<HTMLButtonElement>(`[aria-label="Take #${tag} off"]`);

describe('the page’s tags', () => {
  it('shows the note’s two kinds', () => {
    expect(shown()).toEqual(['#draft', '#wip']);
  });

  it('adds to front matter alone, as a change of Eien’s that counts toward no one’s words', () => {
    tags.set.open();
    const field = tags.set.element.querySelector('input') as HTMLInputElement;
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(editor.text).toBe('---\ntags: [draft, posted]\n---\nA scene. #wip\n');
    expect(changed).toHaveBeenLastCalledWith(editor.text, false);
    expect(shown()).toEqual(['#draft', '#posted', '#wip']);
  });

  it('takes one off, the words left as they were', () => {
    offButton('draft')?.click();
    expect(editor.text).toBe('---\ntags: []\n---\nA scene. #wip\n');
    expect(shown()).toEqual(['#wip']);
  });

  it('says why, and changes nothing, when the front matter can’t be changed in place', () => {
    const broken = '---\ntags: [draft]\ntags: [draft]\n---\nWords.\n';
    editor.setText(broken, async () => null);
    tags.show(broken);
    offButton('draft')?.click();
    expect(editor.text).toBe(broken);
    expect(tell).toHaveBeenCalledWith(expect.stringContaining('Couldn’t take off #draft'));
  });

  it('changes nothing while the text can’t be changed (a seal compared)', () => {
    editable = false;
    offButton('draft')?.click();
    expect(editor.text).toBe(NOTE);
  });

  it('reads a #tag typed in the words once the typing pauses, not mid-word', () => {
    vi.useFakeTimers();
    editor.view.dispatch({ changes: { from: editor.text.length, insert: '#new ' } });
    tags.edited();
    expect(shown()).toEqual(['#draft', '#wip']);
    vi.advanceTimersByTime(1000);
    expect(shown()).toEqual(['#draft', '#wip', '#new']);
  });

  it('opens the field with # on the page, never from the words', () => {
    const title = page.appendChild(document.createElement('h1'));
    title.tabIndex = 0;
    title.dispatchEvent(
      new KeyboardEvent('keydown', { key: '#', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement?.getAttribute('role')).toBe('combobox');
    tags.set.close(false);
    const words = page.querySelector('.editor-host, div') as HTMLElement;
    words.classList.add('editor-host');
    const typed = new KeyboardEvent('keydown', { key: '#', bubbles: true, cancelable: true });
    words.dispatchEvent(typed);
    expect(typed.defaultPrevented).toBe(false);
  });

  it('shows where a tag typed in the words is', () => {
    (tags.set.element.querySelector('.tag--text') as HTMLElement).click();
    const { from, to } = editor.view.state.selection.main;
    expect(editor.text.slice(from, to)).toBe('#wip');
  });

  it('empties with no note open', () => {
    tags.clear();
    expect(tags.set.element.hidden).toBe(true);
  });
});
