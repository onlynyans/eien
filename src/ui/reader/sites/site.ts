// A story site as the reader reads it (spec §14): its pages' markup, read
// into a story, and where each of the reader's turns goes on it. One module
// per site; nothing else knows a site's markup.

import type { SiteId, Story, Turn } from '../../../core/reader';

export interface Found {
  readonly story: Story;
  /** The site's address for `turn`, or null where there's none (the last chapter's next). */
  turnTo(turn: Exclude<Turn, { to: 'original' }>): string | null;
}

export interface Site {
  readonly id: SiteId;
  /** Whether `at` is one of the site's pages: the content script runs on all of them. */
  holds(at: URL): boolean;
  /** The story the page shows, or null when it shows none (a search, a question before a work). */
  read(page: Document, at: URL): Found | null;
}
