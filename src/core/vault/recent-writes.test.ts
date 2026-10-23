import { describe, expect, it } from 'vitest';
import { OWN_ECHO_MS, RecentWrites } from './recent-writes';

describe('recent writes: a write’s echo told from news', () => {
  const clock = () => {
    let now = 1000;
    return { now: () => now, pass: (ms: number) => (now += ms) };
  };

  it('holds a write until its echo can no longer come', () => {
    const time = clock();
    const recent = new RecentWrites(time.now);
    recent.mark(['Fic/One.md'], true);
    expect(recent.has('Fic/One.md')).toBe(true);
    time.pass(OWN_ECHO_MS);
    expect(recent.has('Fic/One.md')).toBe(true);
    time.pass(1);
    expect(recent.has('Fic/One.md')).toBe(false);
  });

  it('counts what’s inside a folder that was moved or trashed', () => {
    const recent = new RecentWrites(clock().now);
    recent.mark(['Fic'], true);
    expect(recent.has('Fic/One.md')).toBe(true);
    expect(recent.has('Fiction/One.md')).toBe(false);
  });

  it('matches a name however its accents were composed', () => {
    const recent = new RecentWrites(clock().now);
    recent.mark(['Café.md'.normalize('NFD')], true);
    expect(recent.has('Café.md'.normalize('NFC'))).toBe(true);
  });

  it('leaves out the writes of the one asking', () => {
    const recent = new RecentWrites<string>(clock().now);
    recent.mark(['One.md'], 'window A');
    expect(recent.has('One.md', 'window A')).toBe(false);
    expect(recent.has('One.md', 'window B')).toBe(true);
    recent.mark(['One.md'], 'window B');
    expect(recent.has('One.md', 'window A')).toBe(true);
  });
});
