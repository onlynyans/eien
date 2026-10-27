// The story sites the reader opens on (spec §14), as a browser extension's
// match patterns name their pages. The extension's manifest and its content
// script both read this list, so a site is added here once.

export const READER_SITES = {
  ao3: { name: 'AO3', matches: ['https://archiveofourown.org/*'] },
  ffn: {
    name: 'FanFiction.Net',
    matches: ['https://www.fanfiction.net/*', 'https://m.fanfiction.net/*'],
  },
} as const;

export type SiteId = keyof typeof READER_SITES;

/** Every page the reader may open on. */
export const READER_MATCHES: readonly string[] = Object.values(READER_SITES).flatMap(
  (site) => site.matches,
);
