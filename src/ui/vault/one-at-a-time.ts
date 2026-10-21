// File operations, one at a time: each starts once the last one, and what
// follows it (a refresh), is done; one that fails doesn't stop the next.
// `idle` is when every one asked for so far is done: a window that closes
// waits for it, so a seal pressed just before isn't cut off half-written.

export interface OneAtATime {
  (operation: () => Promise<unknown>): Promise<void>;
  /** Resolves once every operation asked for so far has finished, or failed. */
  idle(): Promise<void>;
}

export function oneAtATime(after: () => Promise<void>): OneAtATime {
  let last: Promise<void> = Promise.resolve();
  const run = (operation: () => Promise<unknown>) => {
    const running = last.then(async () => {
      await operation();
      await after();
    });
    last = running.catch(console.error);
    return running;
  };
  return Object.assign(run, { idle: () => last });
}
