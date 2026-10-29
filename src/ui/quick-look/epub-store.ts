// The shelf's look (#40, Phase 1c) as the quick look's store: a book's page
// settings read from, and kept under, their `epub.<key>` (core/config's
// epub-look.ts); any other setting is the window's, as the notes' store has it.

import { epubKey, epubLook, isPageLook } from '../../core/config';
import type { LookStore } from './quick-look';

export function epubStore(settings: LookStore): LookStore {
  return {
    get values() {
      return epubLook(settings.values);
    },
    set: (key, value) =>
      isPageLook(key) ? settings.set(epubKey(key), value as never) : settings.set(key, value),
    onChange: (listener) => settings.onChange((values) => listener(epubLook(values))),
  };
}
