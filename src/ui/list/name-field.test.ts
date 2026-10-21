// Renaming in place, as the window draws it: the field over the row's name,
// Enter, Esc and leaving, the taken line, and following the row through a redraw.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { editingName, editName, type NameFieldSpec } from './name-field';

afterEach(() => {
  document.querySelector<HTMLInputElement>('.name-field__input')?.blur();
  document.body.replaceChildren();
});

/** A row drawn as the list draws one: a button holding the note's title. */
function row(title = 'Ideas') {
  const button = document.createElement('button');
  const label = document.createElement('span');
  label.className = 'note-row__title';
  label.textContent = title;
  button.append(label);
  document.body.append(button);
  return { button, label };
}

const field = () => document.querySelector<HTMLInputElement>('.name-field__input');
const key = (name: string) =>
  field()?.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

function open(extra: Partial<NameFieldSpec> = {}) {
  const { label } = row();
  const done = vi.fn();
  const opened = editName({
    name: 'Ideas',
    suffix: '.md',
    label: () => label,
    problem: (typed) =>
      typed.toLowerCase() === 'thaw' ? 'There is one of that name here already.' : null,
    done,
    ...extra,
  });
  return { opened, done, label };
}

describe('editName', () => {
  it('lays the field over the row’s name, its words chosen, the .md after it', () => {
    const { opened, label } = open();
    expect(opened).toBe(true);
    expect(editingName()).toBe(true);
    expect(field()?.value).toBe('Ideas');
    expect(document.activeElement).toBe(field());
    expect(field()?.selectionStart).toBe(0);
    expect(field()?.selectionEnd).toBe(5);
    expect(document.querySelector('.name-field__suffix')?.textContent).toBe('.md');
    expect(label.classList.contains('is-renamed')).toBe(true);
  });

  it('Enter keeps the name typed; the row’s own name shows again', () => {
    const { done, label } = open();
    (field() as HTMLInputElement).value = 'Frost';
    key('Enter');
    expect(done).toHaveBeenCalledWith('Frost', true);
    expect(field()).toBeNull();
    expect(label.classList.contains('is-renamed')).toBe(false);
    expect(editingName()).toBe(false);
  });

  it('Esc keeps the old name', () => {
    const { done } = open();
    (field() as HTMLInputElement).value = 'Frost';
    key('Escape');
    expect(done).toHaveBeenCalledWith(null, true);
  });

  it('the same name, or nothing, is no rename', () => {
    const { done } = open();
    (field() as HTMLInputElement).value = '   ';
    key('Enter');
    expect(done).toHaveBeenCalledWith(null, true);
  });

  it('a taken name says so under the row as it’s typed, and Enter leaves the field open', () => {
    const { done } = open();
    const input = field() as HTMLInputElement;
    input.value = 'thaw';
    input.dispatchEvent(new Event('input'));
    const said = document.querySelector<HTMLElement>('.name-field__problem');
    expect(said?.hidden).toBe(false);
    expect(said?.textContent).toBe('There is one of that name here already.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    key('Enter');
    expect(done).not.toHaveBeenCalled();
    expect(field()).not.toBeNull();
    input.value = 'thaw later';
    input.dispatchEvent(new Event('input'));
    expect(said?.hidden).toBe(true);
  });

  it('no row drawn: nothing opens', () => {
    expect(
      editName({ name: 'x', suffix: '', label: () => null, problem: () => null, done: vi.fn() }),
    ).toBe(false);
    expect(field()).toBeNull();
  });

  it('a second rename ends the first, keeping its name', () => {
    const first = open();
    (field() as HTMLInputElement).value = 'Frost';
    const second = row('Thaw');
    editName({
      name: 'Thaw',
      suffix: '.md',
      label: () => second.label,
      problem: () => null,
      done: vi.fn(),
    });
    expect(first.done).toHaveBeenCalledWith('Frost', false);
    expect(field()?.value).toBe('Thaw');
  });
});
