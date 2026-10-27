// The phone's stack in each room (spec §10, Wide screen): what's in sight,
// what the bar's back names, and what closes as the page goes from sight.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneStack } from './phone-stack';
import type { Room } from './room';

let room: Room;
let parts: ConstructorParameters<typeof PhoneStack>[0];
let stack: PhoneStack;

const shell = () => parts.shell;
const back = () => stack.bar.querySelector('.phone-bar__back') as HTMLButtonElement;

beforeEach(() => {
  room = 'one';
  parts = {
    shell: document.createElement('div'),
    room: () => room,
    backName: (to) => ({ sidebar: 'Library', list: 'Fic', page: 'Page' })[to],
    focus: vi.fn(),
    leavingPage: vi.fn(),
    lost: vi.fn(),
    changed: vi.fn(),
  };
  document.body.append(parts.shell);
  stack = new PhoneStack(parts);
});
afterEach(() => {
  stack.stop();
  document.body.replaceChildren();
});

describe('one at a time', () => {
  it('shows the pane chosen alone, and back names the one before', () => {
    stack.show('page');
    expect(shell().dataset.sight).toBe('page');
    expect(shell().hasAttribute('data-phone')).toBe(true);
    expect(back().textContent).toBe('‹ Fic');
    expect(stack.back()).toBe(true);
    expect(shell().dataset.sight).toBe('list');
    expect(parts.leavingPage).toHaveBeenCalledTimes(1);
  });
});

describe('side by side', () => {
  beforeEach(() => {
    room = 'side';
    stack.roomChanged();
  });

  it('keeps the list beside the page, and back moves the pair a step', () => {
    stack.show('page');
    expect(shell().dataset.room).toBe('side');
    expect(shell().dataset.sight).toBe('list page');
    expect(back().textContent).toBe('‹ Library'); // what back brings into sight: the notes are
    expect(stack.back()).toBe(true);
    expect(shell().dataset.sight).toBe('sidebar list');
    expect(parts.leavingPage).toHaveBeenCalledTimes(1);
  });

  it('has nothing to go back to with the contents in sight: no bar', () => {
    stack.show('list');
    expect(stack.back()).toBe(false);
    expect(stack.bar.hidden).toBe(true);
    expect(stack.inSight('sidebar')).toBe(true);
  });
});

describe('two pages', () => {
  beforeEach(() => {
    room = 'pages';
    stack.roomChanged();
  });

  it('slides the notes over the page, which stays, inert under them: nothing on it closes', () => {
    const page = document.createElement('main');
    page.className = 'page';
    shell().append(page);
    stack.show('page');
    expect(page.inert).toBe(false);
    stack.show('list');
    expect(shell().dataset.sight).toBe('list page');
    expect(page.inert).toBe(true);
    expect(parts.leavingPage).not.toHaveBeenCalled();
    expect(back().textContent).toBe('‹ Library');
    stack.show('page');
    expect(shell().dataset.sight).toBe('page');
    expect(page.inert).toBe(false);
  });

  it('may open a second page; side by side and one at a time may not', () => {
    expect(stack.splits).toBe(true);
    room = 'side';
    stack.roomChanged();
    expect(stack.splits).toBe(false);
  });
});

describe('the room changing', () => {
  it('lays the panes out again, and closes what lay over a page gone from sight', () => {
    room = 'pages';
    stack.roomChanged();
    stack.show('page');
    vi.mocked(parts.changed).mockClear();
    room = 'one';
    stack.roomChanged();
    expect(parts.changed).toHaveBeenCalledTimes(1);
    expect(parts.leavingPage).not.toHaveBeenCalled(); // the page is still the pane shown
    stack.show('list');
    room = 'side';
    stack.roomChanged();
    expect(shell().dataset.sight).toBe('sidebar list');
  });

  it('closes what lay over the page when the room takes it from sight', () => {
    room = 'pages';
    stack.roomChanged();
    stack.show('list'); // the notes over the page: it's still in sight
    expect(parts.leavingPage).not.toHaveBeenCalled();
    room = 'one'; // the notes alone now
    stack.roomChanged();
    expect(parts.leavingPage).toHaveBeenCalledTimes(1);
    room = 'panes';
    stack.roomChanged();
    room = 'side'; // the contents and the notes: the page goes
    stack.roomChanged();
    expect(parts.leavingPage).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the room is the same', () => {
    vi.mocked(parts.changed).mockClear();
    stack.roomChanged();
    expect(parts.changed).not.toHaveBeenCalled();
  });

  it('with the desktop’s panes, shows them all: no pane chosen, no bar', () => {
    room = 'panes';
    stack.roomChanged();
    expect(stack.phone).toBe(false);
    expect(stack.shown).toBeNull();
    expect(shell().hasAttribute('data-phone')).toBe(false);
    expect(shell().dataset.sight).toBe('sidebar list page');
    expect(stack.bar.hidden).toBe(true);
    expect(stack.back()).toBe(false);
  });
});
