// Turns waiting their turn (#40, Phase 3): a turn into another chapter
// waits for it to be drawn, and one fallen back into the chapter before
// waits for that to be drawn again. A key never waits on a motion, but it
// does wait for the page it turns from. One that fails is said, never lost
// silently, and the next goes on.

export class TurnQueue {
  #chain: Promise<void> | null = null;
  #back: Promise<void> | null = null;

  /** `task` after those before it, or now if none waits. */
  run(task: () => void | Promise<void>): void {
    const before = this.#chain;
    const ran = before ? before.then(task) : task();
    if (!ran) return;
    const chain: Promise<void> = ran
      .catch((error: unknown) => console.error('A page turn failed:', error))
      .then(() => {
        if (this.#chain === chain) this.#chain = null;
      });
    this.#chain = chain;
  }

  /** A turn fallen back, its page `drawing` again (if not at once): the next turn waits for it. */
  fellBack(drawing: void | Promise<void>): void {
    if (!drawing) return;
    const back: Promise<void> = drawing
      .catch((error: unknown) => console.error('A page turn failed to fall back:', error))
      .then(() => {
        if (this.#back === back) this.#back = null;
      });
    this.#back = back;
  }

  /** The page a turn fell back to, while it's drawn again; null once it's there. */
  get drawingBack(): Promise<void> | null {
    return this.#back;
  }
}
