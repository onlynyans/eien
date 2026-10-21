// A note renamed in its row: the row the writer is at becomes the field; with
// none in sight, the page's title takes the rename.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renameInRow } from './rename-in-row';

/** happy-dom lays nothing out: a row is in sight when it says it has a box. */
const drawn = vi.spyOn(Element.prototype, 'getClientRects');

beforeEach(() => {
  drawn.mockImplementation(function (this: Element) {
    return (this.isConnected ? [{}] : []) as unknown as DOMRectList;
  });
});
afterEach(() => {
  document.querySelector<HTMLInputElement>('.name-field__input')?.blur();
  document.body.replaceChildren();
});

function listRow(path: string) {
  const button = document.createElement('button');
  button.className = 'note-row';
  button.dataset.path = path;
  const title = document.createElement('span');
  title.className = 'note-row__title';
  title.textContent = path.replace(/\.md$/, '');
  button.append(title);
  document.body.append(button);
  return button;
}

function treeRow(path: string, key: string) {
  const button = document.createElement('button');
  button.className = 'tree-row__name';
  button.dataset.path = path;
  button.dataset.key = key;
  const label = document.createElement('span');
  label.className = 'tree-row__label';
  label.textContent = path.replace(/\.md$/, '');
  button.append(label);
  document.body.append(button);
  return button;
}

const deps = (extra = {}) => ({
  namesIn: vi.fn(() => ['Ideas.md', 'Thaw.md']),
  rename: vi.fn(async (_path: string, typed: string) => `${typed}.md`),
  act: vi.fn(async (operation: () => Promise<unknown>) => {
    await operation();
  }),
  onPage: vi.fn(),
  ...extra,
});
const field = () => document.querySelector<HTMLInputElement>('.name-field__input');
const enter = (value: string) => {
  const input = field() as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
};

describe('renameInRow', () => {
  it('with no row in sight, renames on the page', () => {
    const run = deps();
    renameInRow('Ideas.md', run);
    expect(run.onPage).toHaveBeenCalledWith('Ideas.md');
    expect(field()).toBeNull();
  });

  it('the row with the keyboard is the one renamed: the tree’s, here, not the list’s', () => {
    listRow('Ideas.md');
    const tree = treeRow('Ideas.md', 'note:/#winter:Ideas.md');
    tree.focus();
    renameInRow('Ideas.md', deps());
    expect(tree.querySelector('.tree-row__label')?.classList.contains('is-renamed')).toBe(true);
  });

  it('a taken name is refused in the row, case aside; a free one is renamed, then the row has the keyboard', async () => {
    const run = deps();
    listRow('Ideas.md');
    renameInRow('Ideas.md', run);
    enter('THAW');
    expect(document.querySelector('.name-field__problem')?.textContent).toBe(
      'There is one of that name here already.',
    );
    expect(run.rename).not.toHaveBeenCalled();
    enter('Frost');
    await vi.waitFor(() => expect(run.rename).toHaveBeenCalledWith('Ideas.md', 'Frost'));
    listRow('Frost.md'); // the redraw
    await vi.waitFor(() =>
      expect((document.activeElement as HTMLElement).dataset.path).toBe('Frost.md'),
    );
  });

  it('a name with nothing in it can’t be kept', () => {
    listRow('Ideas.md');
    renameInRow('Ideas.md', deps());
    const input = field() as HTMLInputElement;
    input.value = '...';
    input.dispatchEvent(new Event('input'));
    expect(document.querySelector('.name-field__problem')?.textContent).toBe(
      'A name needs a letter or a number.',
    );
  });

  it('Esc gives the keyboard back to the row', () => {
    const row = listRow('Ideas.md');
    renameInRow('Ideas.md', deps());
    field()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.activeElement).toBe(row);
  });
});
