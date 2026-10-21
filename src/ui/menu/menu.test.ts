import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeMenu, float, type MenuItem, openMenu } from './menu';

const menu = () => document.querySelector<HTMLElement>('[role="menu"]');
const items = () => [...(menu()?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
const press = (key: string) =>
  document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

let opener: HTMLButtonElement;

beforeEach(() => {
  opener = document.createElement('button');
  document.body.replaceChildren(opener);
  opener.focus();
});

afterEach(() => {
  closeMenu();
});

const sorts = (run = vi.fn()): MenuItem[] => [
  { label: 'Order', checked: false, run },
  { label: 'Title', checked: true, run },
  { label: 'Newest', checked: false, run },
];

describe('openMenu', () => {
  it('names the menu and gives each item the role its kind has', () => {
    openMenu(
      [
        { label: 'Rename', run: () => {} },
        'separator',
        { label: 'Focus mode', checked: true, toggle: true, run: () => {} },
        { label: 'Title', checked: false, run: () => {} },
      ],
      { opener },
      'Note',
    );
    expect(menu()?.getAttribute('aria-label')).toBe('Note');
    expect(menu()?.querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(
      items().map((item) => [item.getAttribute('role'), item.getAttribute('aria-checked')]),
    ).toEqual([
      ['menuitem', null],
      ['menuitemcheckbox', 'true'],
      ['menuitemradio', 'false'],
    ]);
  });

  it('puts the keyboard on the choice made, else on the first it can take', () => {
    openMenu(sorts(), { opener });
    expect(document.activeElement?.textContent).toBe('Title');

    openMenu(
      [
        { label: 'Gone', disabled: true, run: () => {} },
        { label: 'Rename', run: () => {} },
      ],
      { opener },
    );
    expect(document.activeElement?.textContent).toBe('Rename');
  });

  it('never starts on a toggle that is on, which Enter would turn off', () => {
    openMenu(
      [
        { label: 'Copy', run: () => {} },
        { label: 'Focus mode', checked: true, toggle: true, run: () => {} },
      ],
      { opener },
    );
    expect(document.activeElement?.textContent).toBe('Copy');
  });

  it('moves with the arrows, round the ends, past what is disabled; Home and End', () => {
    openMenu(
      [
        { label: 'A', run: () => {} },
        { label: 'B', disabled: true, run: () => {} },
        { label: 'C', run: () => {} },
        { label: 'D', run: () => {} },
      ],
      { opener },
    );
    const at = () => document.activeElement?.textContent;
    press('ArrowDown');
    expect(at()).toBe('C');
    press('ArrowDown');
    press('ArrowDown');
    expect(at()).toBe('A');
    press('ArrowUp');
    expect(at()).toBe('D');
    press('Home');
    expect(at()).toBe('A');
    press('End');
    expect(at()).toBe('D');
  });

  it('runs the item chosen once, after closing, and gives the keyboard back', () => {
    const run = vi.fn(() => expect(menu()).toBeNull());
    openMenu(sorts(run), { opener });
    items()[0]?.click();
    expect(run).toHaveBeenCalledOnce();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('closes on Esc or Tab, running nothing, and the keyboard goes back', () => {
    for (const key of ['Escape', 'Tab']) {
      const run = vi.fn();
      openMenu(sorts(run), { opener });
      press(key);
      expect(menu(), key).toBeNull();
      expect(run).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(opener);
    }
  });

  it('keeps its keys to itself, so the window behind does not hear them', () => {
    const heard = vi.fn();
    document.addEventListener('keydown', heard);
    openMenu(sorts(), { opener });
    press('ArrowDown');
    press('Escape');
    document.removeEventListener('keydown', heard);
    expect(heard).not.toHaveBeenCalled();
  });

  it('is the one menu open: opening another closes the first', () => {
    openMenu(sorts(), { opener }, 'First');
    openMenu(sorts(), { opener }, 'Second');
    const menus = document.querySelectorAll('[role="menu"]');
    expect([...menus].map((each) => each.getAttribute('aria-label'))).toEqual(['Second']);
  });
});

describe('float', () => {
  it('closes on a press outside it, not inside, and says so once', () => {
    const closed = vi.fn();
    const panel = document.createElement('div');
    const inside = document.createElement('button');
    panel.append(inside);
    float(panel, { at: { x: 10, y: 10 } }, closed);

    inside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(panel.isConnected).toBe(true);
    opener.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(panel.isConnected).toBe(false);
    expect(closed).toHaveBeenCalledOnce();
    expect(closeMenu()).toBe(false);
  });

  it('closes when the window loses focus or changes width, not height', () => {
    const panel = document.createElement('div');
    float(panel, { opener });
    window.dispatchEvent(new Event('blur'));
    expect(panel.isConnected).toBe(false);

    const width = window.innerWidth;
    const height = window.innerHeight;
    try {
      float(panel, { opener });
      Object.defineProperty(window, 'innerHeight', { value: height - 300, configurable: true });
      window.dispatchEvent(new Event('resize'));
      expect(panel.isConnected).toBe(true);
      Object.defineProperty(window, 'innerWidth', { value: width - 300, configurable: true });
      window.dispatchEvent(new Event('resize'));
      expect(panel.isConnected).toBe(false);
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
    }
  });

  it('stays inside the window, however far right or down it was asked to go', () => {
    const panel = document.createElement('div');
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 120));
    float(panel, { at: { x: window.innerWidth + 500, y: -50 } });
    expect(panel.style.getPropertyValue('--menu-x')).toBe(`${window.innerWidth - 204}px`);
    expect(panel.style.getPropertyValue('--menu-y')).toBe('4px');
  });

  it('opens under its opener when no point is given', () => {
    const panel = document.createElement('div');
    vi.spyOn(opener, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 20, 80, 30));
    float(panel, { opener });
    expect(panel.style.getPropertyValue('--menu-x')).toBe('40px');
    expect(panel.style.getPropertyValue('--menu-y')).toBe('54px');
  });
});

describe('closeMenu', () => {
  it('says whether a menu was open (the system’s back closes it first)', () => {
    expect(closeMenu()).toBe(false);
    openMenu(sorts(), { opener });
    expect(closeMenu()).toBe(true);
    expect(menu()).toBeNull();
    expect(closeMenu()).toBe(false);
  });
});

describe('a row’s menu (Eien’s own)', () => {
  it('is headed by the row’s name, for the eye; each choice an icon, its word and its key', () => {
    openMenu(
      [
        { label: 'Rename', icon: 'rename', keys: 'F2', run: vi.fn() },
        'separator',
        {
          label: 'Move to the trash',
          icon: 'trash',
          keys: 'Mod-Backspace',
          danger: true,
          run: vi.fn(),
        },
      ],
      { at: { x: 10, y: 10 } },
      'Ideas',
      true,
    );
    const head = menu()?.querySelector('.menu__head');
    expect(head?.textContent).toBe('Ideas');
    expect(head?.getAttribute('aria-hidden')).toBe('true');
    expect(menu()?.getAttribute('aria-label')).toBe('Ideas');
    const [rename, trash] = items();
    // Its words are its name alone: the key is drawn by the style sheet, and named for assistive tech.
    expect(rename?.textContent).toBe('Rename');
    expect(rename?.querySelector('svg.icon')).not.toBeNull();
    expect(rename?.getAttribute('aria-keyshortcuts')).toBe('F2');
    expect(rename?.querySelector('.menu__keys')?.getAttribute('data-keys')).toBe('F2');
    expect(trash?.classList.contains('is-danger')).toBe(true);
    expect(trash?.getAttribute('aria-keyshortcuts')).toMatch(/^(Meta|Control)\+Backspace$/);
  });

  it('a menu with no icons stays a list of words, with no head', () => {
    openMenu(sorts(), { at: { x: 0, y: 0 } }, 'Sort');
    expect(menu()?.querySelector('.menu__head')).toBeNull();
    expect(menu()?.classList.contains('menu--icons')).toBe(false);
    expect(items().map((item) => item.textContent)).toEqual(['Order', 'Title', 'Newest']);
  });
});
