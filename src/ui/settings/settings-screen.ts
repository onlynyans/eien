// Settings (spec §6, settings.md): a sheet over the dimmed window, moved by
// its head and resized by its edges (./frame.ts). Its side column holds the
// categories, each a label in the machine voice over its tabs; its head is a
// breadcrumb, SETTINGS / CATEGORY / TAB. Every change shows at once, so
// there is nothing to save. Esc closes it and gives the keyboard back.

import { offeredOn, type SettingKey, type SettingValues } from '../../core/config';
import { h } from '../dom';
import { icon } from '../icons';
import { notesPage, roomForWidths } from '../page/page-room';
import { NARROW, onePane, roomOf, UPRIGHT_PHONE, widthNow } from '../phone/room';
import { reasonOf } from '../reason';
import type { WriterThemes } from '../theme/writer-themes';
import { settingRow } from './controls';
import { frame } from './frame';
import { type Category, placesHere, settingsIn, type Tab } from './places';
import type { SettingsState } from './settings-state';
import { customTab, galleryTab, type ThemesTab } from './themes-tabs';

/** A tab as drawn: its body, how it shows the values, and what it writes before Settings closes. */
interface Drawn {
  readonly category: Category;
  readonly tab: Tab;
  readonly button: HTMLButtonElement;
  readonly body: HTMLElement;
  show(values: SettingValues): void;
  /**
   * Its rows as offered `phone` or not (one pane, the phone's way, offers no panes), and with the
   * notes' page `roomy` or not (../page/page-room.ts): whether any shows.
   */
  fit(phone: boolean, roomy: boolean): boolean;
  flush?(): Promise<void>;
}

/** The Type tab opens with running text, so a change of face, size or weight shows in prose too. Thoreau, Walden. */
const sample = () =>
  h(
    'div',
    { class: 'settings__sample', attrs: { 'aria-hidden': 'true' } },
    h('p', {
      text: 'I had three chairs in my house; one for solitude, two for friendship, three for society.',
    }),
    h('span', { class: 'count', text: '3,051 words · today +809' }),
  );

const VAULT_ABOUT =
  'Settings for this vault only. They’re saved in its .eien/config.json and sync with its notes to every device.';

export class SettingsScreen {
  readonly #dialog: HTMLDialogElement;
  readonly #settings: SettingsState;
  readonly #crumbs = h('p', { class: 'label settings__crumbs' });
  readonly #problem = h('p', {
    class: 'settings__problem',
    attrs: { role: 'alert', hidden: true },
  });
  readonly #tabs: Drawn[] = [];
  readonly #platform: string;
  #shown: Drawn;
  /** The data-key of what had the keyboard when Settings opened: a redraw may replace it. */
  #openerKey: string | null = null;

  /** `platform` (process.platform's name) leaves out the settings another system alone has. */
  constructor(
    container: HTMLElement,
    settings: SettingsState,
    platform: string,
    themes: WriterThemes,
  ) {
    this.#settings = settings;
    this.#platform = platform;
    const set = (key: SettingKey, value: string | number) => void this.#set(key, value);
    const nav = h('nav', { class: 'settings__nav', attrs: { 'aria-label': 'Categories' } });
    const body = h('div', { class: 'settings__body' }, this.#problem);
    // Every setting this system has is drawn; those that need panes show only while there are (#fit).
    for (const category of placesHere(platform)) {
      const labelId = `settings-category-${category.name.toLowerCase().replace(' ', '-')}`;
      const buttons = category.tabs.map((tab) => {
        const drawn = this.#draw(category, tab, platform, themes, set);
        body.append(drawn.body);
        this.#tabs.push(drawn);
        return drawn.button;
      });
      nav.append(
        h(
          'div',
          { class: 'settings__part', attrs: { role: 'group', 'aria-labelledby': labelId } },
          h(
            'h2',
            { class: 'settings__category', attrs: { id: labelId } },
            icon(category.icon),
            category.name,
          ),
          ...buttons,
        ),
      );
    }
    this.#shown = this.#tabs[0] as Drawn;

    const close = h(
      'button',
      {
        class: 'icon-button settings__close',
        attrs: { type: 'button', 'aria-label': 'Close settings', title: 'Close  Esc' },
        on: { click: () => this.close() },
      },
      icon('close'),
    );
    const head = h('header', { class: 'settings__head' }, this.#crumbs, close);
    this.#dialog = h('dialog', { class: 'settings', attrs: { 'aria-label': 'Settings' } });
    const box = frame(this.#dialog, head);
    this.#dialog.append(h('div', { class: 'settings__frame' }, nav, head, body), ...box.grips);

    // Closed, Settings gives the keyboard back to what opened it; if a redraw replaced that
    // (choosing two panes redraws the sidebar), to the control in its place.
    this.#dialog.addEventListener('close', () => {
      for (const tab of this.#tabs) void tab.flush?.();
      const key = this.#openerKey;
      this.#openerKey = null;
      const active = document.activeElement;
      const lost = !active || active === document.body || this.#dialog.contains(active);
      if (key === null || !lost) return;
      [...document.querySelectorAll<HTMLElement>('[data-key]')]
        .find((control) => control.dataset.key === key)
        ?.focus();
    });
    // The dialog's own box, outside the sheet, is only its backdrop: a click there closes it,
    // as Esc does. A press that began inside (a drag let go outside) isn't one.
    let downOutside = false;
    this.#dialog.addEventListener('pointerdown', (event) => {
      downOutside = event.target === this.#dialog;
    });
    this.#dialog.addEventListener('click', (event) => {
      if (event.target === this.#dialog && downOutside && !box.dragging) this.close();
    });
    this.#place = box.place;
    container.append(this.#dialog);
    settings.onChange((values) => this.#show(values));
    // Folded or opened, turned, with Settings open: what the room offers follows.
    for (const width of [NARROW, UPRIGHT_PHONE])
      matchMedia(width).addEventListener('change', () => this.#fit(settings.values));
    this.#show(settings.values);
    this.#choose(this.#shown);
  }

  readonly #place: () => void;

  get isOpen(): boolean {
    return this.#dialog.open;
  }

  /** Open Settings where it was left, or at `category`'s first tab shown here (the quick look's Look). */
  open(category?: string): void {
    if (this.#dialog.open) return;
    this.#problem.hidden = true;
    this.#fit(this.#settings.values); // the window may have turned, or unfolded, since
    const at = this.#tabs.find((tab) => tab.category.name === category && !tab.button.hidden);
    if (at) this.#choose(at);
    const opener = document.activeElement;
    this.#openerKey = opener instanceof HTMLElement ? (opener.dataset.key ?? null) : null;
    this.#place();
    this.#dialog.showModal();
    this.#shown.button.focus();
  }

  close(): void {
    this.#dialog.close();
  }

  #draw(
    category: Category,
    tab: Tab,
    platform: string,
    themes: WriterThemes,
    set: (key: SettingKey, value: string | number) => void,
  ): Drawn {
    const button = h('button', {
      class: 'settings__tab',
      text: tab.name,
      attrs: { type: 'button', 'aria-current': 'false' },
    });
    const drawn = {
      category,
      tab,
      button,
      ...this.#bodyOf(category, tab, platform, themes, set),
    };
    button.addEventListener('click', () => this.#choose(drawn));
    return drawn;
  }

  #bodyOf(
    category: Category,
    tab: Tab,
    platform: string,
    themes: WriterThemes,
    set: (key: SettingKey, value: string | number) => void,
  ): Pick<Drawn, 'body' | 'show' | 'fit' | 'flush'> {
    const label = `${category.name}: ${tab.name}`;
    const body = h('section', {
      class: 'settings__tab-body',
      attrs: { 'aria-label': label, hidden: true },
    });
    if (tab.themes) {
      const choose = (value: string) => set('appearance.palette', value);
      const drawn: ThemesTab =
        tab.themes === 'Gallery' ? galleryTab(choose) : customTab(themes, this.#settings, choose);
      body.append(drawn.element);
      return {
        body,
        show: (values) => drawn.show(values['appearance.palette']),
        fit: () => true,
        flush: drawn.flush,
      };
    }
    const rows = settingsIn(tab, platform).map((setting) => ({
      setting,
      ...settingRow(setting, set),
    }));
    body.append(
      category.scope === 'vault'
        ? h('p', { class: 'setting__about settings__scope', text: VAULT_ABOUT })
        : '',
      tab.name === 'Type' ? sample() : '',
      ...rows.map((row) => row.element),
    );
    const show = (values: SettingValues) => {
      for (const row of rows) row.show(values);
    };
    const fit = (phone: boolean, roomy: boolean) => {
      for (const row of rows) row.element.hidden = !offeredOn(row.setting, platform, phone, roomy);
      return rows.some((row) => !row.element.hidden);
    };
    return { body, show, fit };
  }

  #choose(drawn: Drawn): void {
    this.#shown.body.hidden = true;
    this.#shown.button.setAttribute('aria-current', 'false');
    this.#shown = drawn;
    drawn.body.hidden = false;
    drawn.button.setAttribute('aria-current', 'true');
    drawn.button.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); // a phone's strip
    drawn.body.parentElement?.scrollTo?.({ top: 0 });
    const slash = () => h('span', { class: 'settings__slash', text: '/' });
    this.#crumbs.replaceChildren(
      'Settings',
      slash(),
      drawn.category.name,
      slash(),
      h('b', { text: drawn.tab.name }),
    );
  }

  #show(values: SettingValues): void {
    for (const tab of this.#tabs) tab.show(values);
    this.#fit(values);
  }

  /** Show what's offered in the room the window uses now: one pane, the phone's way, offers no panes. */
  #fit(values: SettingValues): void {
    const phone = onePane(roomOf(widthNow(), this.#platform, values));
    // The notes' page in sight, as Settings sets notes; with none, nothing to measure.
    const page = notesPage();
    const roomy = !page || roomForWidths(page);
    for (const tab of this.#tabs) tab.button.hidden = !tab.fit(phone, roomy);
    for (const part of this.#dialog.querySelectorAll<HTMLElement>('.settings__part')) {
      part.hidden = [...part.querySelectorAll<HTMLElement>('.settings__tab')].every(
        (b) => b.hidden,
      );
    }
    if (this.#shown.button.hidden)
      this.#choose(this.#tabs.find((tab) => !tab.button.hidden) ?? this.#shown);
  }

  async #set(key: SettingKey, value: string | number): Promise<void> {
    this.#problem.hidden = true;
    try {
      // The schema's own keys and values: the main process checks them again.
      await this.#settings.set(key, value as never);
    } catch (error) {
      this.#problem.textContent = reasonOf(error);
      this.#problem.hidden = false;
    }
  }
}
