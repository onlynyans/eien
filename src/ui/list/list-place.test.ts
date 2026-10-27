// The note list keeps its place (backlog #43): drawn again, the same list
// keeps its scroll, though its rows are new; and the row the keyboard was on
// as the pane shut is the one it goes back to.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteList } from '../vault/vault-state';
import { focusList, keepPlace, renderList } from './list';
import { NONE_SHOWN } from './shown-notes';

const list = (heading: string, extra: Partial<NoteList> = {}): NoteList => ({
  kind: 'folder',
  heading,
  notes: Array.from({ length: 40 }, (_, i) => ({
    path: `${heading}/${i}.md`,
    title: `${i}`,
    modified: 0,
    words: 0,
    preview: '',
  })),
  total: 40,
  sort: 'modified',
  sorts: ['order', 'title', 'modified'],
  folder: heading,
  ...extra,
});

const actions = {
  open: vi.fn(),
  menu: vi.fn(),
  rename: vi.fn(),
  trash: vi.fn(),
  nudge: vi.fn(),
  newNote: vi.fn(),
  clearSearch: vi.fn(),
  sort: vi.fn(),
  filter: vi.fn(),
  tags: vi.fn(() => []),
};

let container: HTMLElement;
const draw = (shown: NoteList) => renderList(container, shown, NONE_SHOWN, actions);
const scroller = () => container.querySelector('.rows') as HTMLElement;
const row = (path: string) =>
  container.querySelector<HTMLElement>(`.note-row[data-path="${path}"]`) as HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.replaceChildren(container);
});

describe('the list’s scroll', () => {
  it('is kept when the same list is drawn again, its rows made anew', () => {
    draw(list('Drafts'));
    const before = scroller();
    before.scrollTop = 300;
    draw(list('Drafts'));
    expect(scroller()).not.toBe(before);
    expect(scroller().scrollTop).toBe(300);
  });

  it('starts at the top for another list, or the same one sorted another way', () => {
    draw(list('Drafts'));
    scroller().scrollTop = 300;
    draw(list('Posted'));
    expect(scroller().scrollTop).toBe(0);
    scroller().scrollTop = 300;
    draw(list('Posted', { sort: 'title' }));
    expect(scroller().scrollTop).toBe(0);
  });
});

describe('the keyboard’s place', () => {
  it('goes back to the row it was on as the pane shut, not the first', () => {
    draw(list('Drafts'));
    row('Drafts/7.md').focus();
    keepPlace(container);
    document.body.focus();
    draw(list('Drafts'));
    focusList(container);
    expect(document.activeElement).toBe(row('Drafts/7.md'));
    // Once: next time, the list's own row again.
    document.body.focus();
    focusList(container);
    expect(document.activeElement).toBe(row('Drafts/0.md'));
  });

  it('keeps no place when the keyboard was elsewhere as the pane shut', () => {
    draw(list('Drafts'));
    keepPlace(container);
    focusList(container);
    expect(document.activeElement).toBe(row('Drafts/0.md'));
  });
});
