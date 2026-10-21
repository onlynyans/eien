import { describe, expect, it } from 'vitest';
import { oneAtATime } from './one-at-a-time';

describe('oneAtATime', () => {
  it('runs one after another, and is idle once every one asked for is done, a failure too', async () => {
    const done: string[] = [];
    let release = () => {};
    const act = oneAtATime(async () => {
      done.push('after');
    });
    const first = act(() =>
      new Promise<void>((resolve) => (release = resolve)).then(() => done.push('first')),
    );
    const second = act(async () => {
      throw new Error('refused');
    });
    let idle = false;
    void act.idle().then(() => (idle = true));
    await Promise.resolve();
    expect(idle).toBe(false); // the first is still at work
    release();
    await first;
    await expect(second).rejects.toThrow('refused');
    await act.idle();
    expect(idle).toBe(true);
    expect(done).toEqual(['first', 'after']);
  });

  it('is idle at once with nothing asked for', async () => {
    await expect(oneAtATime(async () => {}).idle()).resolves.toBeUndefined();
  });
});
