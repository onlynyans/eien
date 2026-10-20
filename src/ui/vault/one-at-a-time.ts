// File operations, one at a time: each starts once the last one, and what
// follows it (a refresh), is done; one that fails doesn't stop the next.

export function oneAtATime(
  after: () => Promise<void>,
): (operation: () => Promise<unknown>) => Promise<void> {
  let last: Promise<void> = Promise.resolve();
  return (operation) => {
    const run = last.then(async () => {
      await operation();
      await after();
    });
    last = run.catch(console.error);
    return run;
  };
}
