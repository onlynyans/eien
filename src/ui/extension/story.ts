// The story page (spec §14), in a frame over a story site's page: it asks
// the content script for the story, wears Eien's settings as they change in
// the extension's popup, and keeps where each chapter was left.

import type { SettingValues } from '../../core/config';
import { type FromStory, placeKey, storyMessage } from '../../core/extension';
import { browserApi } from '../../platform/extension/browser';
import { extensionStore } from '../../platform/extension/store';
import { applyLook } from '../settings/look';
import { wear, wornFor } from '../theme/wear';
import { storyView } from './story-view';

const store = extensionStore(browserApi().storage);
/** To the content script in the page round this frame; it acts only on the turns it knows. */
const ask = (message: FromStory) => window.parent.postMessage(message, '*');

const view = storyView(document.body, {
  turn: (turn) => ask({ eien: 'turn', ...turn }),
  scheme: (value) => void store.setSetting({ key: 'appearance.scheme', value }),
  left: (key, at) => void store.setPlace(key, at),
});

const look = (values: SettingValues) => {
  applyLook(values);
  // The vault's own themes aren't the browser's: one of them is Paper here.
  wear(wornFor(values['appearance.palette'], []));
  view.settings(values);
};
void store.settings().then(look);
store.onSettings(look);

window.addEventListener('message', async (event) => {
  // Only the page round the frame: anything else could only show words, but needn't be heard.
  if (event.source !== window.parent) return;
  const story = storyMessage(event.data);
  if (story) view.show(story, await store.place(placeKey(story)));
});
ask({ eien: 'ready' });
