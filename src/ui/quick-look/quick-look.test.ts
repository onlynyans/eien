// The quick look (#49): its head, its rows from the schema's mark, a change
// shown at once, and the keyboard in and out of it, on the desktop and as the
// phone's sheet.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type SettingValues } from '../../core/config';
import type { SettingsBridge } from '../../platform/bridge';
import { closeMenu } from '../menu/menu';
import { SettingsState } from '../settings/settings-state';
import { type LookSubject, QuickLook, type QuickLookOf } from './quick-look';

let settings: SettingsState;
let subject: LookSubject;
let opener: HTMLButtonElement;
let phone: boolean;
let of: QuickLookOf;

beforeEach(async () => {
  let values: SettingValues = DEFAULT_SETTINGS;
  const bridge: SettingsBridge = {
    read: async () => values,
    set: async (key, value) => {
      values = { ...values, [key]: value };
      return values;
    },
  };
  settings = await SettingsState.load(bridge);
  subject = { crumb: 'Notes', every: 'every note', store: settings };
  phone = false;
  opener = document.createElement('button');
  opener.dataset.key = 'command:look';
  document.body.replaceChildren(opener);
  opener.focus();
  of = {
    platform: 'darwin',
    mac: true,
    window: settings,
    phone: () => phone,
    allSettings: vi.fn(),
    changed: vi.fn(),
  };
});
afterEach(() => {
  closeMenu();
  document.body.replaceChildren();
});

const panel = () => document.querySelector<HTMLElement>('.quick-look');
const rowKeys = () =>
  [...(panel()?.querySelectorAll<HTMLElement>('[data-setting]') ?? [])].map(
    (row) => row.dataset.setting,
  );
const button = (key: string, value: string) =>
  panel()?.querySelector<HTMLButtonElement>(`[data-setting="${key}"] [data-value="${value}"]`);
const key = (name: string, init: KeyboardEventInit = {}) =>
  document.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
  );
const settled = () => new Promise((done) => setTimeout(done));

describe('the quick look', () => {
  it('is a dialog named for whose look, its head the breadcrumb, LOOK / NOTES, every note', () => {
    new QuickLook(of).open(subject, opener);
    expect(panel()?.getAttribute('role')).toBe('dialog');
    expect(panel()?.getAttribute('aria-label')).toBe('Look: Notes');
    expect(panel()?.querySelector('.quick-look__crumb')?.textContent).toBe('Look/Notes');
    expect(panel()?.querySelector('.quick-look__every')?.textContent).toBe('every note');
  });

  it('draws the marked settings in the schema’s order, by name only, Day or night for every page', () => {
    new QuickLook(of).open(subject, opener);
    expect(rowKeys()).toEqual([
      'appearance.scheme',
      'appearance.face',
      'appearance.textSize',
      'appearance.leading',
      'page.width',
      'appearance.frame',
    ]);
    const scheme = panel()?.querySelector('[data-setting="appearance.scheme"] .setting__label');
    expect(scheme?.textContent).toBe('Day or nightevery page');
    // Settings has drawn the same rows already: the popover's ids are its own.
    expect(panel()?.querySelector('#quick-appearance-face')).not.toBeNull();
    expect(panel()?.querySelector('#setting-appearance-face')).toBeNull();
  });

  it('leaves page width out on the phone’s one pane, as Settings does', () => {
    phone = true;
    new QuickLook({ ...of, platform: 'android' }).open(subject, opener);
    expect(rowKeys()).not.toContain('page.width');
  });

  it('sets a value at once and shows it chosen, with nothing to confirm', async () => {
    new QuickLook(of).open(subject, opener);
    button('appearance.leading', 'loose')?.click();
    await settled();
    expect(settings.values['appearance.leading']).toBe('loose');
    expect(button('appearance.leading', 'loose')?.getAttribute('aria-pressed')).toBe('true');
    expect(panel()?.isConnected).toBe(true);
  });

  it('shows a change made elsewhere (the sidebar’s sun) while it’s open', async () => {
    new QuickLook(of).open(subject, opener);
    await settings.set('appearance.scheme', 'night');
    expect(button('appearance.scheme', 'night')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('puts the keyboard on the first setting’s chosen value', () => {
    new QuickLook(of).open(subject, opener);
    expect(document.activeElement).toBe(button('appearance.scheme', 'system'));
  });

  it('closes on Esc, the keyboard back on the control, and says it closed', () => {
    const quick = new QuickLook(of);
    quick.open(subject, opener);
    key('Escape');
    expect(panel()).toBeNull();
    expect(quick.isOpen).toBe(false);
    expect(document.activeElement).toBe(opener);
    expect(of.changed).toHaveBeenCalledTimes(2); // opened, closed
  });

  it('closes on the key again (a toggle), and on a click elsewhere, not on its control', () => {
    const quick = new QuickLook(of);
    quick.toggle(subject, opener);
    expect(quick.isOpen).toBe(true);
    quick.toggle(subject, opener);
    expect(quick.isOpen).toBe(false);
    quick.open(subject, opener);
    opener.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(quick.isOpen).toBe(true); // the control's own click toggles it
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(quick.isOpen).toBe(false);
  });

  it('closes when the keyboard goes on to somewhere else (⌘3 into the other page), leaving it there', () => {
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    const quick = new QuickLook(of);
    quick.open(subject, opener);
    elsewhere.focus();
    expect(quick.isOpen).toBe(false);
    expect(document.activeElement).toBe(elsewhere);
    quick.open(subject, opener);
    opener.focus(); // its control, pressed: that's the control's toggle, not a leaving
    expect(quick.isOpen).toBe(true);
  });

  it('gives a value that can’t be kept to the console, not to the writer as a throw', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = { ...settings, values: settings.values, onChange: () => () => {} };
    const failing = { ...subject, store: { ...store, set: () => Promise.reject(new Error('no')) } };
    new QuickLook(of).open(failing, opener);
    button('appearance.frame', 'full')?.click();
    await settled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('opens Settings at Look from All settings, closed first so the control has the keyboard', () => {
    new QuickLook(of).open(subject, opener);
    const all = [...(panel()?.querySelectorAll('button') ?? [])].find((b) =>
      b.textContent?.startsWith('All settings'),
    );
    expect(all?.getAttribute('aria-keyshortcuts')).toBe('Meta+,');
    all?.click();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(of.allSettings).toHaveBeenCalledOnce();
  });
});

describe('the quick look’s keyboard', () => {
  it('makes each setting one stop: Tab and ⇧Tab go round them and All settings, wrapping', () => {
    new QuickLook(of).open(subject, opener);
    const seen: string[] = [];
    for (let i = 0; i < 7; i++) {
      key('Tab');
      const at = document.activeElement as HTMLElement;
      seen.push(at.closest<HTMLElement>('[data-setting]')?.dataset.setting ?? at.textContent ?? '');
    }
    expect(seen).toEqual([
      'appearance.face',
      'appearance.textSize',
      'appearance.leading',
      'page.width',
      'appearance.frame',
      'All settings⌘,',
      'appearance.scheme',
    ]);
    key('Tab', { shiftKey: true });
    expect(document.activeElement?.textContent).toBe('All settings⌘,');
  });

  it('chooses at once with the arrows, within the setting, and keeps its one stop on the choice', async () => {
    new QuickLook(of).open(subject, opener);
    key('ArrowRight'); // System → Day
    await settled();
    expect(settings.values['appearance.scheme']).toBe('day');
    expect(document.activeElement).toBe(button('appearance.scheme', 'day'));
    expect(button('appearance.scheme', 'day')?.tabIndex).toBe(0);
    expect(button('appearance.scheme', 'system')?.tabIndex).toBe(-1);
    key('ArrowLeft');
    key('ArrowLeft'); // past the first: stays
    await settled();
    expect(settings.values['appearance.scheme']).toBe('system');
  });

  it('moves a row in the faces with ↑ and ↓, as they’re laid out', async () => {
    new QuickLook(of).open(subject, opener);
    const cards = [
      ...(panel()?.querySelectorAll<HTMLButtonElement>('[data-setting="appearance.face"] .face') ??
        []),
    ];
    // Two to a row, as the popover lays them (happy-dom lays nothing out).
    cards.forEach((card, at) => {
      Object.defineProperty(card, 'offsetTop', { value: Math.floor(at / 2) * 50 });
      Object.defineProperty(card, 'offsetLeft', { value: (at % 2) * 150 });
    });
    cards[0]?.focus();
    key('ArrowDown');
    await settled();
    expect(document.activeElement).toBe(cards[2]);
    expect(settings.values['appearance.face']).toBe(cards[2]?.dataset.value);
  });

  it('moves between the stepper’s − and + with the arrows, pressing nothing; at an end, the other keeps the keyboard', async () => {
    new QuickLook(of).open(subject, opener);
    const [smaller, larger] =
      panel()?.querySelectorAll<HTMLButtonElement>('[data-setting="appearance.textSize"] button') ??
      [];
    smaller?.focus();
    key('ArrowRight');
    expect(document.activeElement).toBe(larger);
    expect(settings.values['appearance.textSize']).toBe(100);
    smaller?.focus();
    smaller?.click(); // 90: its end
    await settled();
    expect(smaller?.disabled).toBe(true);
    expect(document.activeElement).toBe(larger);
    expect(larger?.tabIndex).toBe(0);
  });

  it('keeps the keys it uses from the window behind', () => {
    new QuickLook(of).open(subject, opener);
    const heard = vi.fn();
    document.addEventListener('keydown', heard);
    key('Tab');
    key('ArrowRight');
    document.removeEventListener('keydown', heard);
    expect(heard).not.toHaveBeenCalled();
  });
});

describe('the quick look on the phone', () => {
  it('is a sheet from the screen’s foot, with Done, which closes it', () => {
    phone = true;
    const quick = new QuickLook({ ...of, platform: 'android' });
    quick.open(subject, opener);
    expect(panel()?.classList.contains('quick-look--sheet')).toBe(true);
    const done = [...(panel()?.querySelectorAll('button') ?? [])].find(
      (b) => b.textContent === 'Done',
    );
    done?.click();
    expect(quick.isOpen).toBe(false);
  });

  it('is closed by the system’s back, as a menu is', () => {
    phone = true;
    const quick = new QuickLook({ ...of, platform: 'android' });
    quick.open(subject, opener);
    expect(closeMenu()).toBe(true);
    expect(quick.isOpen).toBe(false);
  });

  it('shows no key for All settings where there’s no keyboard to press it', () => {
    const coarse = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation(
        (query) => ({ matches: query === '(pointer: coarse)' }) as MediaQueryList,
      );
    phone = true;
    new QuickLook({ ...of, platform: 'android' }).open(subject, opener);
    const all = panel()?.querySelector('.quick-look__foot button');
    expect(all?.textContent).toBe('All settings');
    expect(all?.hasAttribute('aria-keyshortcuts')).toBe(false);
    coarse.mockRestore();
  });

  it('has no Done on the desktop', () => {
    new QuickLook(of).open(subject, opener);
    const words = [...(panel()?.querySelectorAll('.quick-look__foot button') ?? [])].map(
      (b) => b.textContent,
    );
    expect(words).toEqual(['All settings⌘,']);
  });
});
