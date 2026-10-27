// The extension's popup (spec §14): the story on the page, a press from the
// reader, and the extension's settings, drawn as Eien's Settings draws them and
// kept for every story it shows.

import {
  checkSetting,
  type Setting,
  type SettingKey,
  type SettingValues,
  settingOf,
} from '../../core/config';
import { pageAnswer, type ToPage } from '../../core/extension';
import { GALLERY } from '../../core/themes';
import { browserApi } from '../../platform/extension/browser';
import { extensionStore } from '../../platform/extension/store';
import { h, wordButton } from '../dom';
import { type Row, settingRow } from '../settings/controls';
import { applyLook } from '../settings/look';
import { markWorn, themeCard } from '../settings/theme-card';
import { wear, wornFor } from '../theme/wear';
import { STORY_SETTINGS } from './story-settings';

const api = browserApi();
const store = extensionStore(api.storage);
const set = (key: SettingKey, value: string | number) =>
  void store.setSetting(checkSetting(key, value));

/** The gallery's themes as Settings shows them, its cards in their own colours. */
function themes(): Row {
  const cards = h('div', {
    class: 'themes__cards',
    attrs: { role: 'group', 'aria-labelledby': 'setting-appearance-palette' },
  });
  cards.append(
    ...GALLERY.map((theme) =>
      themeCard(
        { name: theme.name, note: theme.note, palette: theme.palette, value: theme.id },
        () => set('appearance.palette', theme.id),
      ),
    ),
  );
  return {
    element: h(
      'div',
      { class: 'setting' },
      h('h3', {
        class: 'setting__label',
        text: 'Theme',
        attrs: { id: 'setting-appearance-palette' },
      }),
      cards,
    ),
    show: (values) =>
      markWorn(cards.querySelectorAll<HTMLElement>('.theme'), values['appearance.palette']),
  };
}

/** The active tab, and what its page says (its story, or nothing: not a story site's page). */
async function askPage(message: ToPage): Promise<{ tab: number; title: string } | null> {
  const [tab] = (await api.tabs?.query({ active: true, currentWindow: true })) ?? [];
  if (tab?.id === undefined) return null;
  try {
    const answer = pageAnswer(await api.tabs?.sendMessage(tab.id, message));
    return answer ? { tab: tab.id, title: answer.title } : null;
  } catch {
    // No content script there to answer: the page isn't one of the sites'.
    return null;
  }
}

function pagePart(): HTMLElement {
  const said = h('p', { class: 'popup__said', text: 'Looking at this page…' });
  const part = h('section', { class: 'popup__page', attrs: { 'aria-label': 'This page' } }, said);
  void askPage({ eien: 'which' }).then((found) => {
    if (!found) {
      said.textContent = 'Open a work on AO3 or FanFiction.Net to read it on Eien’s paper.';
      return;
    }
    said.replaceChildren('On this page: ', h('cite', { text: found.title || 'Untitled' }));
    part.append(
      wordButton('Read in Eien', () => {
        void askPage({ eien: 'open' }).then(() => window.close());
      }),
    );
  });
  return part;
}

const rows: Row[] = STORY_SETTINGS.map((key) =>
  key === 'appearance.palette' ? themes() : settingRow(settingOf(key) as Setting, set),
);
document.body.replaceChildren(
  h(
    'header',
    { class: 'popup__head' },
    h('span', { class: 'seal', text: '永', attrs: { 'aria-hidden': 'true' } }),
    h('h1', { class: 'popup__name', text: 'Eien Reader' }),
  ),
  pagePart(),
  h(
    'section',
    { class: 'popup__settings', attrs: { 'aria-label': 'Settings' } },
    ...rows.map((row) => row.element),
  ),
);

const show = (values: SettingValues) => {
  applyLook(values);
  wear(wornFor(values['appearance.palette'], []));
  for (const row of rows) row.show(values);
};
void store.settings().then(show);
store.onSettings(show);
