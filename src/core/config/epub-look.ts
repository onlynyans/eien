// A book's own look (#40, Phase 1c): its typeface, text size, line spacing,
// page width and frame, apart from the notes'. Not new settings: each is a
// setting #49 marks `quick: 'page'`, kept again under `epub.<key>` on this
// device, with the same label, choices and checks. Settings never draws them
// (it draws SETTINGS); the quick look sets them with a book in front.

import {
  type EpubLookKey,
  type PageLookKey,
  SETTINGS,
  type Setting,
  type SettingValues,
} from './schema';

/** The settings a page wears of its own, in the schema's order. */
export const PAGE_LOOK: readonly (Setting & { readonly key: PageLookKey })[] = SETTINGS.filter(
  (setting): setting is Extract<(typeof SETTINGS)[number], { quick: 'page' }> =>
    'quick' in setting && setting.quick === 'page',
);

/** `key`, the shelf's. */
export const epubKey = (key: PageLookKey): EpubLookKey => `epub.${key}`;

/** Whether `key` is one a page wears of its own. */
export const isPageLook = (key: string): key is PageLookKey =>
  PAGE_LOOK.some((setting) => setting.key === key);

/** The shelf's settings: each page setting under its `epub.` key, kept on this device. */
export const EPUB_LOOK: readonly Setting[] = PAGE_LOOK.map((setting) => ({
  ...setting,
  key: epubKey(setting.key),
  scope: 'device',
}));

/** `values` as a book wears them: each page setting the shelf's. */
export function epubLook(values: SettingValues): SettingValues {
  const worn: Record<string, unknown> = { ...values };
  for (const { key } of PAGE_LOOK) worn[key] = values[epubKey(key)];
  return worn as SettingValues;
}
