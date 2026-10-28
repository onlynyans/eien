// The extension's rules for the shared cleaner (core/html/clean.ts), spec §14:
// a story's links go to the web or to mail, its images come from the web over
// https, and its chapters have no named parts. Anything else (javascript:,
// data:, an address relative to the site) is words only.

import { type CleanNode, type CleanRules, cleanHtml } from '../html';

/** Spaces and control characters in a scheme are what a browser ignores, so they're ignored here. */
const bare = (url: string) => url.replace(/[\s\p{Cc}]/gu, '');

const STORY_RULES: CleanRules = {
  link: (href) => (/^(?:https?:\/\/|mailto:)/iu.test(bare(href)) ? bare(href) : null),
  image: (src) => (/^https:\/\//iu.test(bare(src)) ? bare(src) : null),
};

/** A story site's `html`, kept to what the story page shows. */
export const cleanStory = (html: string): CleanNode[] => cleanHtml(html, STORY_RULES);
