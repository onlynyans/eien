// The story sites the extension opens on (spec §14), as a browser extension's
// match patterns name their pages. The extension's manifest and its content
// script both read this list, so a site is added here once.

export const STORY_SITES = {
  ao3: { name: 'AO3', matches: ['https://archiveofourown.org/*'] },
  ffn: {
    name: 'FanFiction.Net',
    matches: ['https://www.fanfiction.net/*', 'https://m.fanfiction.net/*'],
  },
} as const;

export type SiteId = keyof typeof STORY_SITES;

/** Every page the extension may open on. */
export const STORY_MATCHES: readonly string[] = Object.values(STORY_SITES).flatMap(
  (site) => site.matches,
);
