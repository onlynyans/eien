// A line of news from the last action ("“Ideas” is in the trash."): it
// shows above the note list, or at the sidebar's foot when there's no list,
// for a while, then goes.

/** How long a line of news stays. */
const NOTICE_MS = 8000;

export class Notice {
  #text: string | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  readonly #changed: () => void;

  /** `changed` redraws wherever the line shows. */
  constructor(changed: () => void) {
    this.#changed = changed;
  }

  get text(): string | null {
    return this.#text;
  }

  tell(message: string): void {
    this.#text = message;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#text = null;
      this.#changed();
    }, NOTICE_MS);
    this.#changed();
  }

  stop(): void {
    clearTimeout(this.#timer);
  }
}
