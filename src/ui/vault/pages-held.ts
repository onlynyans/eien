// What the organizer (./organize.ts) asks of the pages (./pages.ts), which
// are made after it: the notes open, held still and changed as they move.

import type { OrganizeContext } from './organize';
import type { Pages } from './pages';

export const pagesHeld = (
  pages: () => Pages,
): Pick<OrganizeContext, 'sessions' | 'closed' | 'freeze' | 'amendOpen'> => ({
  sessions: () => pages().sessions(),
  closed: (path) => pages().closed(path),
  freeze: (path, frozen) => pages().freeze(path, frozen),
  amendOpen: (path, change) => pages().amendOpen(path, change),
});
