// The panes as the window lays them out (./pane-state.ts holds the arithmetic):
// what shuts, what the keyboard does when its pane shuts, and what is remembered.

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { PhonePane } from '../phone/room';
import { DEFAULT_PANES, LIMITS, STEP, THREE_LEAST } from './pane-state';
import { PaneLayout, type PaneParts, paneKeys, type Shuttable } from './panes';

const KEY = 'eien.panes';

let parts: PaneParts & { leave: Mock<(pane: Shuttable) => void>; changed: Mock<() => void> };
let phone: PhonePane | null;
let layout: PaneLayout | undefined;

const make = (two = false, crowds = false) => {
  layout = new PaneLayout(parts, two, crowds);
  return layout;
};
const WIDTH = Object.getOwnPropertyDescriptor(window, 'innerWidth') ??
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'innerWidth') ?? { value: 1024 };
/** The window resized to `width`, as a foldable opens or turns. */
const resizeTo = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  window.dispatchEvent(new Event('resize'));
};
const shell = () => parts.shell;
const edge = (pane: 'sidebar' | 'list') =>
  shell().querySelector<HTMLElement>(`.pane-edge--${pane}`) as HTMLElement;
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');

beforeEach(() => {
  localStorage.clear();
  phone = null;
  const sidebar = document.createElement('aside');
  sidebar.append(document.createElement('button'));
  const list = document.createElement('section');
  list.append(document.createElement('button'));
  const root = document.createElement('div');
  root.append(sidebar, list);
  parts = {
    shell: root,
    sidebar,
    list,
    leave: vi.fn<(pane: Shuttable) => void>(),
    changed: vi.fn<() => void>(),
    phone: () => phone,
    inSight: (pane) => pane === phone,
    beside: () => null,
    showPhone: vi.fn(),
  };
  document.body.replaceChildren(root);
});

afterEach(() => {
  layout?.stop();
  layout = undefined;
  Object.defineProperty(window, 'innerWidth', WIDTH); // happy-dom's own again
});

describe('PaneLayout', () => {
  it('lays out three panes at the default widths, with an edge for each to drag', () => {
    make();
    expect(shell().dataset.panes).toBe('three');
    expect(shell().style.getPropertyValue('--pane-sidebar')).toBe(`${DEFAULT_PANES.sidebar}px`);
    expect(shell().style.getPropertyValue('--pane-list')).toBe(`${DEFAULT_PANES.list}px`);
    const sidebar = edge('sidebar');
    expect(sidebar.getAttribute('role')).toBe('separator');
    expect(sidebar.getAttribute('aria-label')).toBe('Sidebar width');
    expect(sidebar.getAttribute('aria-valuenow')).toBe(String(DEFAULT_PANES.sidebar));
    expect(sidebar.getAttribute('aria-valuemin')).toBe(String(LIMITS.sidebar[0]));
    expect(sidebar.tabIndex).toBe(0);
  });

  it('starts from what this device remembered', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...DEFAULT_PANES, sidebar: 300, listShut: true }));
    const panes = make();
    expect(shell().style.getPropertyValue('--pane-sidebar')).toBe('300px');
    expect(panes.isShut('list')).toBe(true);
    expect(parts.list.inert).toBe(true);
  });

  it('shuts and opens the sidebar to its strip, remembering it, and says it changed', () => {
    // The strip's width is the layout's (./shell.css); here, as Band's strip of desk.
    shell().style.setProperty('--strip', '56px');
    const panes = make();
    panes.toggle('sidebar');
    expect(panes.isShut('sidebar')).toBe(true);
    expect(shell().hasAttribute('data-sidebar-shut')).toBe(true);
    expect(shell().style.getPropertyValue('--pane-sidebar')).toBe('56px');
    expect(stored().sidebarShut).toBe(true);
    expect(parts.changed).toHaveBeenCalledOnce();

    panes.toggle('sidebar');
    expect(panes.isShut('sidebar')).toBe(false);
    expect(stored().sidebarShut).toBe(false);
  });

  it('fits a shut sidebar again to a strip the layout or Shut sidebar changed', () => {
    shell().style.setProperty('--strip', '56px');
    const panes = make();
    panes.toggle('sidebar');
    shell().style.setProperty('--strip', '0px'); // the seal alone: no strip
    panes.refit();
    expect(shell().style.getPropertyValue('--pane-sidebar')).toBe('0px');
    expect(stored().sidebarShut).toBe(true);
  });

  it('shut, the list takes no keyboard: what had it goes to the page', () => {
    const panes = make();
    parts.list.querySelector('button')?.focus();
    panes.toggle('list');
    expect(parts.list.inert).toBe(true);
    expect(parts.leave).toHaveBeenCalledWith('list');

    // Shutting a pane the keyboard isn't in leaves the keyboard be.
    panes.toggle('list');
    panes.toggle('sidebar');
    expect(parts.leave).toHaveBeenCalledOnce();
  });

  it('with two panes the list is gone: it can be neither shut nor opened', () => {
    const panes = make(true);
    expect(shell().dataset.panes).toBe('two');
    expect(panes.isShut('list')).toBe(true);
    expect(shell().style.getPropertyValue('--pane-list')).toBe('0px');
    expect(shell().style.getPropertyValue('--pane-sidebar')).toBe(`${DEFAULT_PANES.sidebarTwo}px`);
    panes.toggle('list');
    expect(panes.open('list')).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(parts.changed).not.toHaveBeenCalled();
  });

  it('going to two panes with the keyboard in the list sends it to the page', () => {
    const panes = make();
    parts.list.querySelector('button')?.focus();
    panes.setTwo(true);
    expect(parts.leave).toHaveBeenCalledOnce();
    expect(parts.changed).toHaveBeenCalledOnce();
    panes.setTwo(true);
    expect(parts.changed).toHaveBeenCalledOnce();
  });

  it('opens a shut pane, and says it’s in sight', () => {
    const panes = make();
    panes.toggle('sidebar');
    expect(panes.open('sidebar')).toBe(true);
    expect(panes.isShut('sidebar')).toBe(false);
    expect(panes.open('sidebar')).toBe(true);
  });

  it('steps a pane’s edge with the arrows, within its limits, and remembers the width', () => {
    make();
    const press = (key: string, init: KeyboardEventInit = {}) =>
      edge('list').dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true, ...init }));
    press('ArrowRight');
    expect(edge('list').getAttribute('aria-valuenow')).toBe(String(DEFAULT_PANES.list + STEP));
    expect(stored().list).toBe(DEFAULT_PANES.list + STEP);
    press('ArrowLeft', { metaKey: true });
    expect(stored().list).toBe(DEFAULT_PANES.list + STEP);
    for (let i = 0; i < 40; i++) press('ArrowLeft');
    expect(stored().list).toBe(LIMITS.list[0]);
  });

  it('follows a drag of an edge across the document, and remembers where it was let go', () => {
    make();
    const at = (type: string, clientX: number, buttons = 1) =>
      new PointerEvent(type, { clientX, buttons, button: 0, bubbles: true, cancelable: true });
    edge('sidebar').dispatchEvent(at('pointerdown', 300));
    expect(shell().classList.contains('is-resizing')).toBe(true);
    document.dispatchEvent(at('pointermove', 340));
    expect(edge('sidebar').getAttribute('aria-valuenow')).toBe(String(DEFAULT_PANES.sidebar + 40));
    expect(localStorage.getItem(KEY)).toBeNull();
    document.dispatchEvent(at('pointerup', 350, 0));
    expect(shell().classList.contains('is-resizing')).toBe(false);
    expect(stored().sidebar).toBe(DEFAULT_PANES.sidebar + 50);

    // Let go: the document's moves no longer move it.
    document.dispatchEvent(at('pointermove', 100));
    expect(stored().sidebar).toBe(DEFAULT_PANES.sidebar + 50);
  });

  it('a move with the button up ends a drag the window never heard let go', () => {
    make();
    edge('sidebar').dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 300, buttons: 1, button: 0, cancelable: true }),
    );
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 400, buttons: 0 }));
    expect(shell().classList.contains('is-resizing')).toBe(false);
    expect(stored().sidebar).toBe(DEFAULT_PANES.sidebar);
  });

  it('keeps going when the window’s storage refuses, holding the panes until it closes', () => {
    const panes = make();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      expect(() => panes.toggle('sidebar')).not.toThrow();
      expect(panes.isShut('sidebar')).toBe(true);
    } finally {
      set.mockRestore();
    }
  });

  describe('on a phone, one pane at a time', () => {
    it('counts every pane but the one in sight as shut, and never has two panes', () => {
      phone = 'list';
      const panes = make(true);
      expect(panes.phone).toBe(true);
      expect(panes.two).toBe(false);
      expect(panes.isShut('list')).toBe(false);
      expect(panes.isShut('sidebar')).toBe(true);
      expect(panes.listKept).toBe(true);
    });

    it('brings a pane into sight rather than opening it beside the others', () => {
      phone = 'page';
      const panes = make();
      expect(panes.open('sidebar')).toBe(true);
      expect(parts.showPhone).toHaveBeenCalledWith('sidebar');
      panes.openPage();
      expect(parts.showPhone).toHaveBeenLastCalledWith('page');
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('hiding the sidebar goes on to the notes', () => {
      phone = 'sidebar';
      make().toggle('sidebar');
      expect(parts.showPhone).toHaveBeenCalledWith('list');
    });
  });

  describe('side by side, the pane beside the page', () => {
    it('is as wide as it was left, and its edge steps it, remembered', () => {
      phone = 'page';
      parts = { ...parts, inSight: (pane) => pane !== 'sidebar', beside: () => 'list' };
      make();
      expect(shell().style.getPropertyValue('--pane-list')).toBe(`${DEFAULT_PANES.list}px`);
      edge('list').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }),
      );
      expect(stored().list).toBe(DEFAULT_PANES.list + STEP);
      expect(shell().style.getPropertyValue('--pane-list')).toBe(`${DEFAULT_PANES.list + STEP}px`);
    });

    it('keeps its width though the sidebar was shut on the desktop’s panes', () => {
      phone = 'list';
      parts = { ...parts, inSight: (pane) => pane !== 'page', beside: () => 'sidebar' };
      localStorage.setItem(KEY, JSON.stringify({ sidebarShut: true }));
      make();
      expect(shell().style.getPropertyValue('--pane-sidebar')).toBe(`${DEFAULT_PANES.sidebar}px`);
    });
  });

  describe('side by side, the pane before in sight too', () => {
    it('counts the contents in sight beside a folder’s notes as open', () => {
      phone = 'list';
      parts = { ...parts, inSight: (pane) => pane !== 'page' };
      const panes = make();
      expect(panes.isShut('sidebar')).toBe(false);
      expect(panes.isShut('list')).toBe(false);
      expect(panes.two).toBe(false); // the notes are the list's, not the tree's
    });

    it('hiding the contents, beside the notes, goes on past them to the page', () => {
      phone = 'list';
      parts = { ...parts, inSight: (pane) => pane !== 'page' };
      make().toggle('sidebar');
      expect(parts.showPhone).toHaveBeenCalledWith('page');
    });

    it('hiding the contents, at them, goes past the notes beside to the page', () => {
      phone = 'sidebar';
      parts = { ...parts, inSight: (pane) => pane !== 'page' };
      make().toggle('sidebar');
      expect(parts.showPhone).toHaveBeenCalledWith('page');
    });

    it('hiding the contents does nothing once they’re out of sight', () => {
      phone = 'page';
      parts = { ...parts, inSight: (pane) => pane !== 'sidebar' };
      make().toggle('sidebar');
      expect(parts.showPhone).not.toHaveBeenCalled();
    });
  });
});

describe('paneKeys', () => {
  it('writes each pane’s key as the system does', () => {
    expect(paneKeys(true)).toEqual({ sidebar: '⌘\\', list: '⇧⌘\\' });
    expect(paneKeys(false)).toEqual({ sidebar: 'Ctrl+\\', list: 'Ctrl+Shift+\\' });
  });
});

describe('the list stepping aside for a split (Tools that follow)', () => {
  it('goes out of sight while split, the tree listing the notes, and is never saved as shut', () => {
    const panes = make();
    panes.stepAside(true);
    expect(panes.isShut('list')).toBe(true);
    expect(panes.two).toBe(true);
    expect(panes.aside).toBe(true);
    expect(shell().dataset.panes).toBe('two');
    expect(stored()?.listShut ?? false).toBe(false);
    panes.stepAside(false);
    expect(panes.isShut('list')).toBe(false);
    expect(panes.two).toBe(false);
  });

  it('comes back with its toggle, and stays back until the split asks again', () => {
    const panes = make();
    panes.stepAside(true);
    panes.toggle('list'); // ⇧⌘\, or its chevron
    expect(panes.isShut('list')).toBe(false);
    expect(panes.aside).toBe(false);
    panes.stepAside(true); // the window drawn again, still split: the list stays
    expect(panes.isShut('list')).toBe(false);
    panes.stepAside(false);
    panes.stepAside(true); // a new split: it steps aside again
    expect(panes.isShut('list')).toBe(true);
    expect(stored()?.listShut ?? false).toBe(false);
  });

  it('gives the keyboard to the page when it steps aside with it inside', () => {
    const panes = make();
    parts.list.querySelector('button')?.focus();
    panes.stepAside(true);
    expect(parts.leave).toHaveBeenCalled();
  });

  it('leaves two panes as they are', () => {
    const panes = make(true);
    panes.stepAside(true);
    panes.stepAside(false);
    expect(panes.two).toBe(true);
    expect(panes.isShut('list')).toBe(true);
  });
});

describe('a phone’s Panes with no room for three (#68)', () => {
  it('shows two, the tree listing the notes, never saved; three again once there’s room', () => {
    resizeTo(THREE_LEAST);
    const panes = make(false, true);
    expect(panes.two).toBe(false);
    resizeTo(THREE_LEAST - 1); // a Galaxy Z Fold 5 opened, turned on its side
    expect(panes.crowded).toBe(true);
    expect(panes.two).toBe(true);
    expect(panes.isShut('list')).toBe(true);
    expect(parts.list.inert).toBe(true);
    expect(shell().dataset.panes).toBe('two');
    expect(shell().hasAttribute('data-list-shut')).toBe(true);
    expect(parts.changed).toHaveBeenCalledTimes(1); // drawn again, the tree with its notes
    expect(stored()?.listShut ?? false).toBe(false);
    resizeTo(THREE_LEAST - 100); // narrower still: two as they were, nothing drawn again
    expect(parts.changed).toHaveBeenCalledTimes(1);
    resizeTo(THREE_LEAST);
    expect(panes.two).toBe(false);
    expect(panes.isShut('list')).toBe(false);
    expect(parts.changed).toHaveBeenCalledTimes(2);
  });

  it('Back (#70) opens the sidebar while crowded, never a list there’s no room for', () => {
    resizeTo(THREE_LEAST - 1);
    const panes = make(false, true);
    panes.toggle('sidebar');
    expect(panes.reopen()).toBe(true);
    expect(panes.isShut('sidebar')).toBe(false);
    expect(panes.isShut('list')).toBe(true);
    expect(panes.reopen()).toBe(false);
  });

  it('hands the keyboard on when the list goes with it inside', () => {
    resizeTo(1024);
    make(false, true);
    parts.list.querySelector('button')?.focus();
    resizeTo(600);
    expect(parts.leave).toHaveBeenCalledWith('list');
  });

  it('keeps a desktop window that narrow at three, giving way, and two chosen as it is', () => {
    resizeTo(600);
    expect(make().two).toBe(false);
    layout?.stop();
    const two = make(true, true);
    expect(two.two).toBe(true);
    expect(two.crowded).toBe(false); // two chosen: nothing to say about three
  });

  it('hands the keyboard on when one pane at a time becomes Panes too narrow for three', () => {
    resizeTo(600);
    phone = 'list'; // one at a time, the keyboard in the list
    const panes = make(false, true);
    parts.list.querySelector('button')?.focus();
    phone = null; // Wide screen set to Panes, or the window unfolded
    panes.relayout();
    expect(panes.crowded).toBe(true);
    expect(parts.leave).toHaveBeenCalledWith('list');
  });

  it('crowds nothing one pane at a time, the phone’s way', () => {
    resizeTo(600);
    phone = 'list';
    const panes = make(false, true);
    expect(panes.crowded).toBe(false);
    expect(panes.isShut('list')).toBe(false); // in sight, the phone's pane
  });

  it('keeps the list aside for a split once there’s room again', () => {
    resizeTo(600);
    const panes = make(false, true);
    panes.stepAside(true);
    resizeTo(1024);
    expect(panes.aside).toBe(true);
    expect(panes.isShut('list')).toBe(true);
  });
});

describe('back reopening the panes (#70)', () => {
  it('opens the list, then the sidebar, then has nothing left to open', () => {
    const panes = make();
    panes.toggle('sidebar');
    panes.toggle('list');
    expect(panes.reopen()).toBe(true);
    expect(panes.isShut('list')).toBe(false);
    expect(panes.isShut('sidebar')).toBe(true);
    expect(panes.reopen()).toBe(true);
    expect(panes.isShut('sidebar')).toBe(false);
    expect(panes.reopen()).toBe(false);
  });

  it('opens the sidebar alone with two panes, where there is no list', () => {
    const panes = make(true);
    panes.toggle('sidebar');
    expect(panes.reopen()).toBe(true);
    expect(panes.isShut('sidebar')).toBe(false);
    expect(panes.reopen()).toBe(false);
  });

  it('with two panes and the list stepped aside, opens the sidebar and leaves the split as it is', () => {
    const panes = make(true);
    panes.stepAside(true);
    panes.toggle('sidebar');
    expect(panes.reopen()).toBe(true);
    expect(panes.isShut('sidebar')).toBe(false);
    expect(panes.aside).toBe(true);
    expect(panes.reopen()).toBe(false);
  });

  it('brings back the list a split stepped aside, as its toggle does', () => {
    const panes = make();
    panes.stepAside(true);
    expect(panes.reopen()).toBe(true);
    expect(panes.isShut('list')).toBe(false);
    expect(panes.aside).toBe(false);
  });

  it('leaves back to the stack the phone’s way', () => {
    phone = 'page';
    const panes = make();
    expect(panes.reopen()).toBe(false);
    expect(parts.showPhone).not.toHaveBeenCalled();
  });
});
