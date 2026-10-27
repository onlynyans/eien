// The reader extension's manifest (spec §14), for Chrome, Edge, Brave and
// Firefox alike (Manifest V3). It asks for the least it can: storage for the
// settings and places, and the story sites' pages alone, where its content
// script reads the story and its reader's page may be framed. Nothing runs in
// the background, and nothing is fetched.

import { READER_MATCHES } from '../../core/reader';

/** The icon's sizes, from the seal's own (build/icons/linux): a toolbar's, the extensions page's, a store's. */
export const ICON_SIZES = [16, 32, 48, 128] as const;

const icons = Object.fromEntries(ICON_SIZES.map((size) => [size, `icons/${size}.png`]));

export function readerManifest(version: string) {
  return {
    manifest_version: 3,
    name: 'Eien Reader',
    version,
    description:
      'Read stories on AO3 and FanFiction.Net on Eien’s paper: its typefaces, themes, day and night.',
    icons,
    action: { default_title: 'Eien Reader', default_popup: 'popup.html', default_icon: icons },
    permissions: ['storage'],
    content_scripts: [{ matches: [...READER_MATCHES], js: ['content.js'], run_at: 'document_end' }],
    web_accessible_resources: [{ resources: ['reader.html'], matches: [...READER_MATCHES] }],
    browser_specific_settings: {
      gecko: {
        id: 'reader@eien.onlynyans.github.io',
        strict_min_version: '140.0',
        // Firefox asks each add-on to say what it collects: nothing.
        data_collection_permissions: { required: ['none'] },
      },
    },
  };
}
