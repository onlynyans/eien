import { describe, expect, it, vi } from 'vitest';
import { h, wordButton } from './dom';

describe('h', () => {
  it('makes the element with its class, text and children, leaving out what is nothing', () => {
    const element = h('p', { class: 'a b', text: 'Hello' });
    expect(element.tagName).toBe('P');
    expect(element.className).toBe('a b');
    expect(element.textContent).toBe('Hello');

    const list = h('ul', {}, h('li', { text: 'one' }), null, undefined, false, 'two', '');
    expect([...list.childNodes].map((node) => node.textContent)).toEqual(['one', 'two']);
  });

  it('writes an attribute as given, true as present and empty, and leaves out the rest', () => {
    const element = h('button', {
      attrs: { 'aria-label': 'Seal', hidden: true, 'aria-current': undefined, disabled: false },
    });
    expect(element.getAttribute('aria-label')).toBe('Seal');
    expect(element.getAttribute('hidden')).toBe('');
    expect(element.hasAttribute('aria-current')).toBe(false);
    expect(element.hasAttribute('disabled')).toBe(false);
  });

  it('sets text as text, never as markup', () => {
    const element = h('span', { text: '<img src=x onerror=alert(1)>' });
    expect(element.children).toHaveLength(0);
    expect(element.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('listens for each event given', () => {
    const click = vi.fn();
    const keydown = vi.fn();
    const element = h('div', { on: { click, keydown } });
    element.click();
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(click).toHaveBeenCalledOnce();
    expect(keydown).toHaveBeenCalledOnce();
  });
});

describe('wordButton', () => {
  it('is a button that submits nothing, with its word, and runs on a click', () => {
    const run = vi.fn();
    const button = wordButton('New note', run, { 'aria-keyshortcuts': 'Meta+N' });
    expect(button.type).toBe('button');
    expect(button.className).toBe('word-button');
    expect(button.textContent).toBe('New note');
    expect(button.getAttribute('aria-keyshortcuts')).toBe('Meta+N');
    button.click();
    expect(run).toHaveBeenCalledOnce();
  });

  it('takes another class from its attributes', () => {
    expect(wordButton('Sort', () => {}, { class: 'word-button list__sort' }).className).toBe(
      'word-button list__sort',
    );
  });
});
