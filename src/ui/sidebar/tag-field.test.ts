// A new tag named in place: what can be a tag, what's there already, Enter,
// Esc and leaving, and what's typed kept through the sidebar's redraws.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { TagField } from './tag-field';

afterEach(() => document.body.replaceChildren());

function field(known: string[] = ['draft']) {
  const done = vi.fn();
  let drawing = false;
  const tags = new TagField({
    drawing: () => drawing,
    known: () => new Set(known),
    done,
  });
  const draw = () => {
    const list = document.createElement('ul');
    drawing = true;
    list.append(...tags.rows());
    document.body.replaceChildren(list);
    drawing = false;
    tags.restore(document.body);
    return document.querySelector<HTMLInputElement>('.tree-row__field');
  };
  return { tags, done, draw };
}

const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input'));
};
const key = (input: HTMLInputElement, name: string) =>
  input.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

describe('TagField', () => {
  it('draws nothing until started', () => {
    const { tags, draw } = field();
    expect(tags.active).toBe(false);
    expect(draw()).toBeNull();
  });

  it('Enter makes the tag typed, its # taken off', () => {
    const { tags, done, draw } = field();
    tags.start();
    const input = draw() as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    type(input, '#ideas');
    key(input, 'Enter');
    expect(done).toHaveBeenCalledWith('ideas');
    expect(tags.active).toBe(false);
  });

  it('says what can’t be a tag, or what’s there already, and stays open on Enter', () => {
    const { tags, done, draw } = field(['draft']);
    tags.start();
    const input = draw() as HTMLInputElement;
    type(input, 'two words');
    const said = document.querySelector<HTMLElement>('.tree-hint--problem');
    expect(said?.textContent).toMatch(/letters and numbers/);
    key(input, 'Enter');
    expect(done).not.toHaveBeenCalled();
    type(input, 'Draft');
    expect(said?.textContent).toBe('#Draft is there already.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('Esc makes nothing; neither does Enter on an empty field', () => {
    const one = field();
    one.tags.start();
    key(one.draw() as HTMLInputElement, 'Escape');
    expect(one.done).toHaveBeenCalledWith(null);
    const two = field();
    two.tags.start();
    key(two.draw() as HTMLInputElement, 'Enter');
    expect(two.done).toHaveBeenCalledWith(null);
  });

  it('what’s typed, and where, outlives a redraw', () => {
    const { tags, draw } = field();
    tags.start();
    const input = draw() as HTMLInputElement;
    type(input, 'posted');
    input.setSelectionRange(2, 4);
    input.dispatchEvent(new Event('select'));
    const again = draw() as HTMLInputElement;
    expect(again).not.toBe(input);
    expect(again.value).toBe('posted');
    expect(document.activeElement).toBe(again);
    expect([again.selectionStart, again.selectionEnd]).toEqual([2, 4]);
  });
});
