// The tags on the page (backlog #13; docs/design/explorations/tags.md), as
// the window draws them: front matter's with a ×, the text's with none, the
// field and its menu by keyboard and pointer.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TagChoice } from '../../core/tags';
import { TagSet, type TagSetOf } from './tag-set';

const VAULT: TagChoice[] = [
  { tag: 'posted', count: 4 },
  { tag: 'fic/aot', count: 2 },
];

let of: TagSetOf & { [K in keyof TagSetOf]: ReturnType<typeof vi.fn> };
let set: TagSet;

beforeEach(() => {
  of = {
    choices: vi.fn((typed: string, has: readonly string[]) => {
      const open = VAULT.filter((c) => !has.includes(c.tag) && c.tag.includes(typed));
      return typed && !VAULT.some((c) => c.tag === typed)
        ? [...open, { tag: typed, count: 0, made: true as const }]
        : open;
    }),
    add: vi.fn(),
    remove: vi.fn(),
    find: vi.fn(),
  };
  set = new TagSet(of);
  document.body.append(set.element);
  set.show({ front: ['draft', 'fic/aot'], inline: ['wip'] });
});

afterEach(() => {
  document.body.replaceChildren();
});

const field = () => set.element.querySelector('input') as HTMLInputElement;
const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
const press = (key: string) =>
  field().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const button = (name: string) =>
  [...set.element.querySelectorAll<HTMLButtonElement>('button')].find(
    (each) => each.getAttribute('aria-label') === name,
  );

describe('the note’s tags', () => {
  it('shows front matter’s with a ×, the text’s with none, saying why', () => {
    const tags = [...set.element.querySelectorAll('.tag')].map((tag) => tag.textContent);
    expect(tags).toEqual(['#draft', '#fic/aot', '#wip']);
    expect(button('Take #draft off')).toBeDefined();
    expect(button('Take #wip off')).toBeUndefined();
    expect(set.element.querySelector('.tag--text')?.getAttribute('data-tip')).toBe(
      'In the text · show where',
    );
  });

  it('takes one off with its ×, and shows one typed in the text where it is', () => {
    button('Take #fic/aot off')?.click();
    expect(of.remove).toHaveBeenCalledWith('fic/aot');
    (set.element.querySelector('.tag--text') as HTMLElement).click();
    expect(of.find).toHaveBeenCalledWith('wip');
  });

  it('is drawn again only when the tags differ, the keyboard kept on the + when one goes', () => {
    const first = set.element.querySelector('.tag');
    set.show({ front: ['draft', 'fic/aot'], inline: ['wip'] });
    expect(set.element.querySelector('.tag')).toBe(first);
    button('Take #draft off')?.focus();
    set.show({ front: ['fic/aot'], inline: ['wip'] });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Take #fic/aot off');
    set.show({ front: [], inline: ['wip'] });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Add a tag');
  });

  it('hides with no note open', () => {
    set.show(null);
    expect(set.element.hidden).toBe(true);
    set.open();
    expect(field().hidden).toBe(true);
  });
});

describe('the field', () => {
  it('opens from the +, the keyboard in it, its menu the vault’s tags the note lacks', () => {
    button('Add a tag')?.click();
    expect(document.activeElement).toBe(field());
    expect(options().map((option) => option.textContent)).toEqual(['#posted4']);
    expect(of.choices).toHaveBeenLastCalledWith('', ['draft', 'fic/aot', 'wip']);
    expect(field().getAttribute('aria-expanded')).toBe('true');
    expect(field().getAttribute('aria-activedescendant')).toBe(options()[0]?.id);
  });

  it('offers to make a new tag, the arrows going round, Enter adding the one picked', () => {
    set.open();
    field().value = 'new';
    field().dispatchEvent(new Event('input'));
    expect(options().map((option) => option.textContent)).toEqual(['Make #newnew tag']);
    field().value = 'p';
    field().dispatchEvent(new Event('input'));
    expect(options().map((option) => option.textContent)).toEqual(['#posted4', 'Make #pnew tag']);
    press('ArrowUp');
    expect(options()[1]?.getAttribute('aria-selected')).toBe('true');
    press('ArrowDown');
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true');
    press('Enter');
    expect(of.add).toHaveBeenCalledWith('posted');
    expect(field().value).toBe(''); // ready for another
  });

  it('adds one chosen with the pointer, the field keeping the keyboard', () => {
    set.open();
    const option = options()[0] as HTMLElement;
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    option.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    option.click();
    expect(of.add).toHaveBeenCalledWith('posted');
  });

  it('takes the last of front matter’s off with ⌫ when empty, never the text’s', () => {
    set.open();
    press('Backspace');
    expect(of.remove).toHaveBeenCalledWith('fic/aot');
    set.show({ front: [], inline: ['wip'] });
    of.remove.mockClear();
    press('Backspace');
    expect(of.remove).not.toHaveBeenCalled();
  });

  it('closes with Esc, the + given the keyboard and the menu gone', () => {
    set.open();
    press('Escape');
    expect(field().hidden).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Add a tag');
    expect(options()).toEqual([]);
  });

  it('shows no menu when there’s nothing to offer', () => {
    set.show({ front: ['posted', 'fic/aot'], inline: [] });
    set.open();
    expect(options()).toEqual([]);
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(field().hasAttribute('aria-activedescendant')).toBe(false);
  });
});
