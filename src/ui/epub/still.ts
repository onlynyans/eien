// When a book's pages are still (#40, Phase 4 and 5): no turn showing a
// copy of a page, so background work (the count, a search) may take a task
// without taking a frame from a turn.

/** Run `then` once no page is turning. */
export type Still = (then: () => void) => void;

/**
 * `then` once every page `waits` names is still at once: each asked in turn,
 * and if any had to be waited for, all asked again (one may have begun a
 * turn meanwhile, or another page joined), until a pass finds every one
 * still as it's asked. `waits` is read anew each pass.
 */
export function allStill(waits: () => readonly Still[], then: () => void): void {
  const now = waits();
  let waited = false;
  const step = (i: number): void => {
    const wait = now[i];
    if (!wait) {
      if (waited) allStill(waits, then);
      else then();
      return;
    }
    let sync = true;
    wait(() => {
      if (!sync) waited = true;
      step(i + 1);
    });
    sync = false;
  };
  step(0);
}
