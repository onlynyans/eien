// The quick look (backlog #49, docs/quick-look.md): a popover of the look's
// everyday settings, under the Look control, or on the phone a sheet from
// the screen's foot. Its head says whose look it sets (LOOK / NOTES); its
// rows are the settings the schema marks `quick`, drawn as Settings draws
// them (../settings/controls.ts), names only. A change shows at once: there's
// nothing to confirm. It floats as a menu does (../menu/menu.ts): the one
// thing open, closed by Esc, the key again, a click elsewhere or the phone's
// back, the keyboard then back where it was.

import type { Setting, SettingKey, SettingValues } from '../../core/config';
import { commandOf } from '../chrome/commands';
import { keysOf } from '../chrome/keys';
import { h } from '../dom';
import { float, touch } from '../menu/menu';
import { settingRow } from '../settings/controls';
import { quickIn } from '../settings/places';
import { quickKey, setStops, stopsIn } from './quick-keys';

/** Where a look's values are kept: the notes' are the settings themselves (../settings/settings-state.ts). */
export interface LookStore {
  readonly values: SettingValues;
  set<K extends SettingKey>(key: K, value: SettingValues[K]): Promise<void>;
  onChange(listener: (values: SettingValues) => void): () => void;
}

/**
 * Whose look the popover sets: its name in the head (NOTES), what that covers (every note), and
 * where its values are kept. #40 Phase 1 adds the shelf's, its values under `epub.<key>`.
 */
export interface LookSubject {
  readonly crumb: string;
  readonly every: string;
  readonly store: LookStore;
}

export interface QuickLookOf {
  /** The system's name (process.platform's, or the phone's): what Settings offers here. */
  readonly platform: string;
  readonly mac: boolean;
  /** The window's settings: a setting marked `window` (Day or night) is theirs, whatever the page. */
  readonly window: LookStore;
  /** Whether the window goes the phone's way: a sheet from the screen's foot, with Done. */
  phone(): boolean;
  /** All settings: Settings, at Look. */
  allSettings(): void;
  /** Opened or closed: the control says which. */
  changed(): void;
}

export class QuickLook {
  readonly #of: QuickLookOf;
  #close: (() => void) | null = null;
  #subject: LookSubject | null = null;

  constructor(of: QuickLookOf) {
    this.#of = of;
  }

  get isOpen(): boolean {
    return this.#close !== null;
  }

  /** The key again, or the control: open `subject`'s look under `opener`, or close it. */
  toggle(subject: LookSubject, opener: HTMLElement | null): void {
    if (this.#subject === subject) this.close();
    else this.open(subject, opener);
  }

  close(): void {
    this.#close?.();
  }

  open(subject: LookSubject, opener: HTMLElement | null): void {
    this.close();
    const of = this.#of;
    const phone = of.phone();
    const storeOf = (setting: Setting) => (setting.quick === 'window' ? of.window : subject.store);
    const rows = quickIn(of.platform, phone).map((setting) => {
      const set = (key: SettingKey, value: string | number) =>
        void storeOf(setting)
          .set(key, value as never)
          .catch(console.error);
      const row = settingRow(setting, set, 'quick');
      if (setting.quick === 'window')
        row.element
          .querySelector('.setting__label')
          ?.append(h('span', { class: 'quick-look__aside', text: 'every page' }));
      return { setting, ...row };
    });
    // Settings' own key, shown as a menu shows keys: not where there's no keyboard to press it.
    const keys = touch() ? null : keysOf(commandOf('settings'), of.mac);
    const allSettings = h(
      'button',
      {
        class: 'word-button',
        attrs: { type: 'button', 'aria-keyshortcuts': keys?.aria },
        on: {
          click: () => {
            // Closed first, so Settings gives the keyboard back to the control, not to this.
            this.close();
            of.allSettings();
          },
        },
      },
      'All settings',
      keys
        ? h('span', { class: 'quick-look__key', text: keys.text, attrs: { 'aria-hidden': 'true' } })
        : null,
    );
    const done = phone
      ? h('button', {
          class: 'word-button',
          text: 'Done',
          attrs: { type: 'button' },
          on: { click: () => this.close() },
        })
      : null;
    const panel = h(
      'div',
      {
        class: phone ? 'quick-look quick-look--sheet' : 'quick-look',
        attrs: { role: 'dialog', 'aria-label': `Look: ${subject.crumb}` },
      },
      h(
        'div',
        { class: 'quick-look__head' },
        h(
          'span',
          // Settings' own breadcrumb (../settings/settings.css).
          { class: 'label settings__crumbs quick-look__crumb' },
          'Look',
          h('span', { class: 'settings__slash', text: '/', attrs: { 'aria-hidden': 'true' } }),
          h('b', { text: subject.crumb }),
        ),
        h('span', { class: 'quick-look__every', text: subject.every }),
      ),
      h('div', { class: 'quick-look__body' }, ...rows.map((row) => row.element)),
      h('div', { class: 'quick-look__foot' }, allSettings, done),
    );
    const show = () => {
      const had = document.activeElement;
      for (const row of rows) row.show(storeOf(row.setting).values);
      setStops(panel, had);
    };
    // The keyboard gone on to somewhere else (⌘3 into the other page): it closes, leaving it there.
    panel.addEventListener('focusout', (event) => {
      const to = event.relatedTarget;
      // Its control taking it is a press on it, which toggles.
      if (to instanceof Node && !panel.contains(to) && to !== opener) this.close();
    });
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
      else if (!quickKey(event, panel)) return;
      event.preventDefault();
      event.stopPropagation();
    });
    const stores = [...new Set([of.window, subject.store])];
    const stops = stores.map((store) => store.onChange(show));
    this.#subject = subject;
    this.#close = float(panel, { opener: opener ?? undefined, end: true }, () => {
      for (const stop of stops) stop();
      this.#close = null;
      this.#subject = null;
      of.changed();
    });
    show();
    // The keyboard goes to the first setting's chosen value.
    stopsIn(panel)[0]?.focus();
    of.changed();
  }
}
