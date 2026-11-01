import { describe, expect, it, vi } from 'vitest';
import { Backs } from './backs';

describe('the system’s back, asked of the window’s handlers', () => {
  it('asks the newest first, until one went back', () => {
    const backs = new Backs();
    const older = vi.fn(() => true);
    const newer = vi.fn(() => false);
    backs.add(older);
    backs.add(newer);
    expect(backs.run()).toBe(true);
    expect(newer).toHaveBeenCalledBefore(older);
  });

  it('says none went back, and forgets a handler stopped', () => {
    const backs = new Backs();
    const stop = backs.add(() => true);
    expect(backs.run()).toBe(true);
    stop();
    expect(backs.run()).toBe(false);
  });
});
