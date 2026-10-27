// The few parts of a browser's extension API the extension uses (spec §14), typed
// here rather than with a package of the whole API: Chrome's and Firefox's
// agree on these, and both answer with promises in Manifest V3. Firefox names
// it `browser`, Chromium `chrome`.

export interface StorageArea {
  get(keys: string | readonly string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface StorageChange {
  readonly newValue?: unknown;
}

export interface BrowserStorage {
  /** Kept on this browser: where you stopped, whether the story page is open. */
  readonly local: StorageArea;
  /** Kept with the browser's account, on each of its devices: the settings. */
  readonly sync: StorageArea;
  readonly onChanged: {
    addListener(listener: (changes: Record<string, StorageChange>, area: string) => void): void;
  };
}

export interface MessageSender {
  readonly id?: string;
}

export interface BrowserApi {
  readonly storage: BrowserStorage;
  readonly runtime: {
    readonly id: string;
    getURL(path: string): string;
    readonly onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: MessageSender,
          respond: (answer: unknown) => void,
        ) => undefined,
      ): void;
    };
  };
  /** Only the extension's own pages (the popup) have tabs; a content script doesn't. */
  readonly tabs?: {
    query(which: { active: true; currentWindow: true }): Promise<{ readonly id?: number }[]>;
    sendMessage(tab: number, message: unknown): Promise<unknown>;
  };
}

/** The browser's extension API, where the page is the extension's (or its content script). */
export function browserApi(): BrowserApi {
  const scope = globalThis as { browser?: BrowserApi; chrome?: BrowserApi };
  const api = scope.browser?.storage ? scope.browser : scope.chrome;
  if (!api?.storage) throw new Error('Eien Reader runs only as a browser extension.');
  return api;
}
