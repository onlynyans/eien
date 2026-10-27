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
