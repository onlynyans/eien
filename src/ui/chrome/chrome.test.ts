// The chrome as the window draws it: each layout's hosts in their slots,
// every command a button once, pressed through to what it runs, and a switch
// of layouts that keeps the keyboard on the same command.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Chrome, type ChromeOf } from './chrome';
import { COMMANDS, type CommandId, LAYOUTS, onDesktopIn } from './commands';
import type { CommandLook } from './host';
import type { SlotName } from './layout-spec';

const SLOTS: readonly SlotName[] = [
  'top',
  'pageBar',
  'format',
  'sidebarChevron',
  'listChevron',
  'foot',
  'phoneBar',
  'phoneFoot',
];
const PHONE: readonly SlotName[] = ['phoneBar', 'phoneFoot'];

let slots: Record<SlotName, HTMLElement>;
let looks: Map<CommandId, CommandLook>;

const of = (extra: Partial<ChromeOf> = {}): ChromeOf => ({
  mac: true,
  slots,
  look: (id) => looks.get(id) ?? {},
  send: vi.fn(),
  local: vi.fn(),
  lost: vi.fn(),
  watch: vi.fn(),
  ...extra,
});

/** The commands drawn in the desktop's slots, as each button names its own. */
const desktopCommands = () =>
  SLOTS.filter((slot) => !PHONE.includes(slot)).flatMap((slot) =>
    [...slots[slot].querySelectorAll<HTMLElement>('[data-command]')].map(
      (button) => button.dataset.command,
    ),
  );

beforeEach(() => {
  looks = new Map();
  slots = Object.fromEntries(
    SLOTS.map((slot) => [slot, document.createElement('div')]),
  ) as unknown as Record<SlotName, HTMLElement>;
  document.body.replaceChildren(...Object.values(slots));
});

describe.each(LAYOUTS)('the %s layout, mounted', (layout) => {
  it('draws each command it offers on the desktop as one button, and no other', () => {
    new Chrome(of()).mount(layout);
    const offered = COMMANDS.filter((command) => onDesktopIn(command, layout)).map((c) => c.id);
    expect(desktopCommands().sort()).toEqual([...offered].sort());
  });

  it('gives each button its name, key and identity across layouts', () => {
    new Chrome(of()).mount(layout);
    const seal = document.querySelector<HTMLButtonElement>('[data-command="seal"]');
    expect(seal?.getAttribute('aria-label')).toBe('Seal');
    expect(seal?.getAttribute('aria-keyshortcuts')).toBe('Meta+S');
    expect(seal?.dataset.shortcut).toBe('⌘S');
    expect(seal?.dataset.key).toBe('command:seal');
    expect(seal?.type).toBe('button');
    expect(document.querySelector('[data-command="settings"]')?.getAttribute('aria-haspopup')).toBe(
      'dialog',
    );
  });

  it('draws each host as a named toolbar, and lets the window watch each for tooltips', () => {
    const watch = vi.fn();
    new Chrome(of({ watch })).mount(layout);
    const hosts = [...document.querySelectorAll<HTMLElement>('.host')];
    expect(hosts.length).toBeGreaterThan(0);
    for (const host of hosts) {
      expect(host.getAttribute('role')).toBe('toolbar');
      expect(host.getAttribute('aria-label')).toBeTruthy();
    }
    expect(new Set(watch.mock.calls.map(([host]) => host))).toEqual(new Set(hosts));
    expect(watch).toHaveBeenCalledTimes(hosts.length);
  });

  it('stands the split’s pager with the page’s tools: the phone’s, while it goes the phone’s way', () => {
    const pager = document.createElement('span');
    let phone = false;
    const chrome = new Chrome(of({ pager, phone: () => phone }));
    chrome.mount(layout);
    const inPhone = () => PHONE.some((slot) => slots[slot].contains(pager));
    expect(pager.isConnected && !inPhone()).toBe(true);
    phone = true; // Two pages, folded: the desktop's bars are out of sight
    chrome.refresh();
    expect(inPhone()).toBe(true);
    phone = false;
    chrome.refresh();
    expect(pager.isConnected && !inPhone()).toBe(true);
  });
});

describe('Chrome', () => {
  it('puts a host marked first before what its slot already holds', () => {
    const crumb = document.createElement('nav');
    slots.top.append(crumb);
    new Chrome(of()).mount('runhead');
    expect(slots.top.firstElementChild?.classList.contains('host--runhead-panes')).toBe(true);
    expect(slots.top.lastElementChild?.classList.contains('host--runhead-tools')).toBe(true);
  });

  it('runs a button’s menu command, or the window’s own with the button pressed', () => {
    const send = vi.fn();
    const local = vi.fn();
    new Chrome(of({ send, local })).mount('band');
    document.querySelector<HTMLButtonElement>('[data-command="seal"]')?.click();
    expect(send).toHaveBeenCalledWith('seal', 'seal');
    const scheme = document.querySelector<HTMLButtonElement>('[data-command="scheme"]');
    scheme?.click();
    expect(local).toHaveBeenCalledWith('scheme', scheme);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('shows how each command looks now, once what it ran is done', async () => {
    const chrome = new Chrome(of());
    chrome.mount('band');
    const focus = () => document.querySelector<HTMLButtonElement>('[data-command="focus"]');
    expect(focus()?.hasAttribute('aria-pressed')).toBe(false);
    expect(focus()?.dataset.tip).toBe('Focus mode: dim all but the current paragraph');

    looks.set('focus', { pressed: true, disabled: true, tip: 'Focus · on', icon: 'sun' });
    focus()?.click();
    expect(focus()?.getAttribute('aria-pressed')).toBe(null);
    await Promise.resolve();
    expect(focus()?.getAttribute('aria-pressed')).toBe('true');
    expect(focus()?.disabled).toBe(true);
    expect(focus()?.dataset.tip).toBe('Focus · on');
    expect(focus()?.querySelector('svg')?.dataset.icon).toBe('sun');

    looks.set('focus', {});
    chrome.refresh();
    expect(focus()?.hasAttribute('aria-pressed')).toBe(false);
    expect(focus()?.disabled).toBe(false);
    expect(focus()?.querySelector('svg')?.dataset.icon).toBe('focus');
  });

  it('draws a pane’s chevron with its own icon, whatever the command’s look says', () => {
    looks.set('pane.sidebar', { icon: 'sidebar' });
    new Chrome(of()).mount('band');
    const chevron = slots.sidebarChevron.querySelector('[data-command="pane.sidebar"] svg');
    expect((chevron as SVGElement | null)?.dataset.icon).toBe('left');
  });

  it('writes keys as this system does', () => {
    new Chrome(of({ mac: false })).mount('band');
    const compare = document.querySelector<HTMLElement>('[data-command="compare"]');
    expect(compare?.getAttribute('aria-keyshortcuts')).toBe('Control+Shift+D');
    expect(compare?.dataset.shortcut).toBe('Ctrl+Shift+D');
  });

  it('switches layouts by taking one’s hosts out and putting the other’s in', () => {
    const chrome = new Chrome(of());
    chrome.mount('band');
    chrome.mount('runhead');
    expect(chrome.layout).toBe('runhead');
    expect(document.querySelector('.host--band-tools')).toBeNull();
    expect(desktopCommands().filter((id) => id === 'seal')).toHaveLength(1);
    expect(chrome.buttons('strip')).toEqual([]);

    chrome.unmount();
    expect(chrome.layout).toBeNull();
    expect(document.querySelectorAll('.host')).toHaveLength(0);
  });

  it('keeps the keyboard on the same command across a switch', () => {
    const lost = vi.fn();
    const chrome = new Chrome(of({ lost }));
    chrome.mount('band');
    chrome.buttons('seal')[0]?.focus();
    chrome.mount('slip');
    expect(document.activeElement).toBe(chrome.buttons('seal')[0]);
    expect(document.activeElement?.closest('.host--slip')).not.toBeNull();
    expect(lost).not.toHaveBeenCalled();
  });

  it('asks the window to place the keyboard when its command is gone from the new layout', () => {
    const lost = vi.fn();
    const chrome = new Chrome(of({ lost }));
    chrome.mount('band');
    chrome.buttons('strip')[0]?.focus();
    chrome.mount('runhead');
    expect(lost).toHaveBeenCalledOnce();
  });

  it('leaves the keyboard alone when it was not on the chrome', () => {
    const lost = vi.fn();
    const field = document.createElement('input');
    document.body.append(field);
    const chrome = new Chrome(of({ lost }));
    chrome.mount('band');
    field.focus();
    chrome.mount('slip');
    expect(document.activeElement).toBe(field);
    expect(lost).not.toHaveBeenCalled();
  });

  it('mounting the layout already shown changes nothing', () => {
    const chrome = new Chrome(of());
    chrome.mount('band');
    const seal = chrome.buttons('seal')[0];
    chrome.mount('band');
    expect(chrome.buttons('seal')[0]).toBe(seal);
  });

  it('moves along a toolbar with the arrows, round its ends, past a disabled button', () => {
    looks.set('versions', { disabled: true });
    const chrome = new Chrome(of());
    chrome.mount('runhead');
    const tools = document.querySelector('.host--runhead-tools') as HTMLElement;
    const ids = () => (document.activeElement as HTMLElement | null)?.dataset.command;
    const arrow = (key: string, init: KeyboardEventInit = {}) =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
      );
    chrome.buttons('seal')[0]?.focus();
    arrow('ArrowRight');
    expect(ids()).toBe('format-bar');
    arrow('ArrowRight');
    expect(ids()).toBe('focus');
    arrow('ArrowRight');
    expect(ids()).toBe('view.live');
    arrow('ArrowLeft');
    expect(ids()).toBe('focus');
    arrow('ArrowLeft', { shiftKey: true });
    expect(ids()).toBe('focus');
    expect(tools.contains(document.activeElement)).toBe(true);
  });
});
