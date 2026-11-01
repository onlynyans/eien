// What the organizer (./organize.ts) asks of the pages (./pages.ts), which
// are made after it: the notes open (./note-pages.ts), held still and changed
// as they move, and the pages showing what went to the trash.

import type { OrganizeContext } from './organize';
import type { Pages } from './pages';

export const pagesHeld = (
  pages: () => Pages,
): Pick<OrganizeContext, 'sessions' | 'closed' | 'freeze' | 'amendOpen'> => ({
  sessions: () => pages().notes.sessions(),
  closed: (path) => pages().closed(path),
  freeze: (path, frozen) => pages().notes.freeze(path, frozen),
  amendOpen: (path, change) => pages().notes.amendOpen(path, change),
});
