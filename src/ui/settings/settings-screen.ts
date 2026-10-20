// The settings screen (spec §6), drawn from the schema: one section per
// group, a choice as a row of words, a number as a step down and up. Each
// change is kept and shows at once, so there is nothing to save.

import {
  type ChoiceSetting,
  type NumberSetting,
  SETTING_GROUPS,
  SETTINGS,
  type Setting,
  type SettingKey,
  type SettingValues,
  stepped,
} from '../../core/config';
import { h, wordButton } from '../dom';
import { reasonOf } from '../reason';
import type { SettingsState } from './settings-state';

export class SettingsScreen {
  readonly #dialog: HTMLDialogElement;
  readonly #problem = h('p', {
    class: 'settings__problem',
    attrs: { role: 'alert', hidden: true },
  });
  readonly #settings: SettingsState;
  /** Each control's way of showing the current values. */
  readonly #shows: ((values: SettingValues) => void)[] = [];

  constructor(container: HTMLElement, settings: SettingsState) {
    this.#settings = settings;
    const groups = SETTING_GROUPS.map((group) => {
      const rows = SETTINGS.filter((setting) => setting.group === group).map((setting) =>
        this.#row(setting),
      );
      return rows.length > 0
        ? h(
            'section',
            { class: 'settings__group' },
            h('h2', { class: 'label', text: group }),
            ...rows,
          )
        : null;
    });
    this.#dialog = h(
      'dialog',
      { class: 'settings', attrs: { 'aria-labelledby': 'settings-title' } },
      h(
        'div',
        { class: 'settings__inner' },
        h(
          'header',
          { class: 'settings__head' },
          h('h1', {
            class: 'label settings__title',
            text: 'Settings',
            attrs: { id: 'settings-title' },
          }),
          wordButton('Close', () => this.close()),
        ),
        this.#problem,
        h('div', { class: 'settings__body' }, ...groups),
      ),
    );
    // The dialog's own box is only its backdrop: a click there closes it, as Esc does.
    this.#dialog.addEventListener('click', (event) => {
      if (event.target === this.#dialog) this.close();
    });
    container.append(this.#dialog);
    settings.onChange((values) => this.#show(values));
    this.#show(settings.values);
  }

  get isOpen(): boolean {
    return this.#dialog.open;
  }

  open(): void {
    if (this.#dialog.open) return;
    this.#problem.hidden = true;
    this.#dialog.showModal();
  }

  close(): void {
    this.#dialog.close();
  }

  #show(values: SettingValues): void {
    for (const show of this.#shows) show(values);
  }

  #row(setting: Setting): HTMLElement {
    const labelId = `setting-${setting.key.replace('.', '-')}`;
    return h(
      'div',
      { class: 'setting' },
      h(
        'div',
        { class: 'setting__head' },
        h('h3', { class: 'label setting__label', text: setting.label, attrs: { id: labelId } }),
        setting.scope === 'vault' && h('span', { class: 'count', text: 'This vault' }),
      ),
      h('p', { class: 'setting__about', text: setting.description }),
      setting.type === 'choice' ? this.#choices(setting, labelId) : this.#stepper(setting, labelId),
    );
  }

  #choices(setting: ChoiceSetting, labelId: string): HTMLElement {
    const face = setting.key === 'appearance.face';
    const buttons = Object.entries(setting.choices).map(([value, name]) =>
      wordButton(name, () => void this.#set(setting.key, value), {
        'data-value': value,
        // A face shows in itself: its tokens apply inside any element that names it.
        ...(face ? { 'data-face': value, class: 'word-button setting__face' } : {}),
      }),
    );
    this.#shows.push((values) => {
      const chosen = chosenIn(values, setting.key);
      for (const button of buttons)
        button.setAttribute('aria-pressed', String(button.dataset.value === chosen));
    });
    return h(
      'div',
      { class: 'setting__choices', attrs: { role: 'group', 'aria-labelledby': labelId } },
      ...buttons,
    );
  }

  #stepper(setting: NumberSetting, labelId: string): HTMLElement {
    let current = setting.default;
    const step = (by: number) => () => void this.#set(setting.key, stepped(setting, current, by));
    const smaller = wordButton('Smaller', step(-1));
    const larger = wordButton('Larger', step(1));
    const shown = h('output', { class: 'count setting__value', attrs: { 'aria-live': 'polite' } });
    this.#shows.push((values) => {
      current = Number(chosenIn(values, setting.key));
      shown.textContent = `${current}%`;
      smaller.disabled = current <= setting.min;
      larger.disabled = current >= setting.max;
    });
    return h(
      'div',
      { class: 'setting__stepper', attrs: { role: 'group', 'aria-labelledby': labelId } },
      smaller,
      shown,
      larger,
    );
  }

  async #set(key: string, value: string | number): Promise<void> {
    this.#problem.hidden = true;
    try {
      // The schema's own keys and values: the main process checks them again.
      await this.#settings.set(key as SettingKey, value as never);
    } catch (error) {
      this.#problem.textContent = reasonOf(error);
      this.#problem.hidden = false;
    }
  }
}

const chosenIn = (values: SettingValues, key: string): unknown =>
  (values as Record<string, unknown>)[key];
