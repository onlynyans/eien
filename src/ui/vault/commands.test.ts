// The menu's Split Page (⌘D) in each room (spec §10): a second page opens only
// where two pages may; a split closes anywhere.

import { describe, expect, it, vi } from 'vitest';
import { type CommandContext, runCommand } from './commands';

function context(split: boolean, splits: boolean) {
  const toggle = vi.fn(async () => {});
  const pages = { split, toggle, active: { page: {}, versions: {} } };
  const ctx = { pages, splits: () => splits } as unknown as CommandContext;
  return { ctx, toggle };
}

describe('Split Page', () => {
  it('opens a second page where two pages may', () => {
    const { ctx, toggle } = context(false, true);
    runCommand('split', ctx);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('opens none one page at a time, or side by side, with a keyboard', () => {
    const { ctx, toggle } = context(false, false);
    runCommand('split', ctx);
    expect(toggle).not.toHaveBeenCalled();
  });

  it('closes a split in any room', () => {
    const { ctx, toggle } = context(true, false);
    runCommand('split', ctx);
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});

// QA (#40, Phase 4b): View → Bookmark This Page and the phone's ⋯ send 'bookmark'.
describe('Bookmark This Page', () => {
  it('bookmarks the page in sight when a book is the active page', () => {
    const bookmark = vi.fn(async () => {});
    const pages = {
      active: { kind: 'epub', go: () => {}, marks: { bookmarks: { toggle: bookmark } } },
    };
    runCommand('bookmark', { pages } as unknown as CommandContext);
    expect(bookmark).toHaveBeenCalledOnce();
  });

  it('does nothing with a note in front (the menu greys it)', () => {
    const pages = { active: { kind: 'note', page: {}, versions: {} } };
    expect(() => runCommand('bookmark', { pages } as unknown as CommandContext)).not.toThrow();
  });
});

// #40, Phase 5a: Format → Highlight (⇧⌘H) with a book in front keeps its words chosen.
describe('Format → Highlight', () => {
  it('highlights the words chosen in the book when a book is the active page', () => {
    const highlight = vi.fn(async () => {});
    const pages = {
      active: { kind: 'epub', go: () => {}, marks: { highlights: { toggle: highlight } } },
    };
    const ctx = { pages, parts: { outline: { open: false } } } as unknown as CommandContext;
    runCommand('format:highlight', ctx);
    expect(highlight).toHaveBeenCalledOnce();
  });

  it('formats a note’s words with a note in front, as before', () => {
    const format = vi.fn();
    const active = { kind: 'note', page: { editor: { format } }, versions: {} };
    const pages = { active, activeNote: active };
    const ctx = { pages, parts: { outline: { open: false } } } as unknown as CommandContext;
    runCommand('format:highlight', ctx);
    expect(format).toHaveBeenCalledOnce();
  });
});

// QA (#40, Phase 5b): View → Next Mark and Previous Mark walk the book in front.
describe('View → Next Mark and Previous Mark', () => {
  it('walk the marks of the book in front, on and back', () => {
    const walk = vi.fn();
    const pages = { active: { kind: 'epub', go: () => {}, marks: { walk } } };
    const ctx = { pages } as unknown as CommandContext;
    runCommand('mark:next', ctx);
    runCommand('mark:previous', ctx);
    expect(walk.mock.calls).toEqual([[1], [-1]]);
  });

  it('do nothing with a note in front (the menu greys them)', () => {
    const walk = vi.fn();
    // A note's page, with whatever it may hold called marks, is never walked.
    const active = { kind: 'note', page: {}, versions: {}, marks: { walk } };
    const ctx = { pages: { active, activeNote: active } } as unknown as CommandContext;
    expect(() => {
      runCommand('mark:next', ctx);
      runCommand('mark:previous', ctx);
    }).not.toThrow();
    expect(walk).not.toHaveBeenCalled();
  });
});
