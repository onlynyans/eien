import { describe, expect, it } from 'vitest';
import { sealedWhen } from './seal-time';

const now = Date.UTC(2026, 9, 20, 12, 0, 0);
const MIN = 60_000;

describe('sealedWhen', () => {
  it('says how long ago, then the date', () => {
    expect(sealedWhen(now, now)).toBe('just now');
    expect(sealedWhen(now - 59_999, now)).toBe('just now');
    expect(sealedWhen(now - MIN, now)).toBe('1m ago');
    expect(sealedWhen(now - 59 * MIN, now)).toBe('59m ago');
    expect(sealedWhen(now - 60 * MIN, now)).toBe('1h ago');
    expect(sealedWhen(now - 23 * 60 * MIN - 59 * MIN, now)).toBe('23h ago');
    expect(sealedWhen(Date.UTC(2026, 9, 12, 12), now, 'en-US')).toBe('Oct 12');
    expect(sealedWhen(Date.UTC(2025, 9, 12, 12), now, 'en-US')).toBe('Oct 12, 2025');
  });

  it('says “just now” for a seal from a device whose clock runs ahead', () => {
    expect(sealedWhen(now + 5 * MIN, now)).toBe('just now');
  });
});
