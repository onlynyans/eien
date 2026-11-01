// The system's back (Bridge.onBack): the handlers the window gave, asked
// the newest first until one went back. Android's button and edge swipe,
// and a Mac trackpad's swipe between pages, each through its own preload.

export class Backs {
  readonly #handlers: (() => boolean)[] = [];

  /** `handler` asked on each back; the returned function stops it. */
  add(handler: () => boolean): () => void {
    this.#handlers.push(handler);
    return () => {
      const at = this.#handlers.lastIndexOf(handler);
      if (at >= 0) this.#handlers.splice(at, 1);
    };
  }

  /** Back: whether any handler went back. */
  run(): boolean {
    return [...this.#handlers].reverse().some((handler) => handler());
  }
}
