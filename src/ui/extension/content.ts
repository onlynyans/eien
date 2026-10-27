// The content script (spec §14), on every page of the sites the extension reads.
// Where the page shows a story it puts the seal in the corner; the seal, or
// the popup's Read in Eien, opens the story page over the site's, and it
// stays open as its chapters are turned, until it's closed. Built on its own
// as one plain script (vite.extension.config.ts), as a content script can't
// be a module.

import type { SettingValues } from '../../core/config';
import { pageMessage, storyAsk } from '../../core/extension';
import { browserApi } from '../../platform/extension/browser';
import { extensionStore } from '../../platform/extension/store';
import { type StoryFrame, sealButton, storyFrame } from './page-overlay';
import { type Found, siteFor } from './sites';

function start(found: Found): void {
  const api = browserApi();
  const store = extensionStore(api.storage);
  const storyPage = api.runtime.getURL('story.html');
  // Its origin as written, not URL's: an extension's scheme isn't one URL knows an origin for everywhere.
  const storyOrigin = api.runtime.getURL('').replace(/\/$/u, '');
  let frame: StoryFrame | null = null;

  const open = () => {
    if (frame) return;
    frame = storyFrame(document, storyPage);
    seal.show(false);
    void store.setOpen(true);
  };
  const close = () => {
    frame?.close();
    frame = null;
    seal.show(true);
    void store.setOpen(false);
  };
  const seal = sealButton(document, open);
  const paint = (values: SettingValues) => seal.paint(values);
  void store.settings().then(paint);
  store.onSettings(paint);

  window.addEventListener('message', (event) => {
    // Only the story page's own frame: the site's script can post here too.
    if (!frame?.window || event.source !== frame.window) return;
    const asked = storyAsk(event.data);
    if (!asked) return;
    if (asked.eien === 'ready') {
      frame.window.postMessage({ eien: 'story', story: found.story }, storyOrigin);
    } else if (asked.to === 'original') {
      close();
    } else {
      const to = found.turnTo(asked);
      if (to) window.location.assign(to);
    }
  });

  api.runtime.onMessage.addListener((message, sender, respond) => {
    const asked = sender.id === api.runtime.id ? pageMessage(message) : null;
    if (!asked) return undefined;
    if (asked.eien === 'open') open();
    respond({ title: found.story.title });
    return undefined;
  });

  void store.isOpen().then((isOpen) => {
    if (isOpen) open();
    else seal.show(true);
  });
}

const found = siteFor(new URL(window.location.href))?.read(document, new URL(window.location.href));
if (found) start(found);
