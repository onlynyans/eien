import { describe, expect, it, vi } from 'vitest';

/** ipcMain as the router sees it: each channel's one handler. */
const handlers = new Map<
  string,
  (event: { sender: { id: number } }, ...args: unknown[]) => unknown
>();
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: never) => {
      if (handlers.has(channel))
        throw new Error(`Attempted to register a second handler for '${channel}'`);
      handlers.set(channel, handler);
    },
  },
}));

/** A window, as far as the router needs one: its page's id, and its close. */
class FakeWindow {
  static #next = 1;
  readonly webContents = { id: FakeWindow.#next++ };
  #closed: (() => void)[] = [];
  once(_event: 'closed', listener: () => void): void {
    this.#closed.push(listener);
  }
  close(): void {
    for (const listener of this.#closed) listener();
  }
}

const { answer } = await import('./ipc');
const call = (channel: string, from: FakeWindow, ...args: unknown[]) =>
  handlers.get(channel)?.({ sender: { id: from.webContents.id } }, ...args);

// The router listens to each channel once for good, so each test uses channels of its own.
describe('answering the windows (New Window: a channel for many windows)', () => {
  it('lets a second window answer a channel the first does, each its own', () => {
    const a = new FakeWindow();
    const b = new FakeWindow();
    answer(a as never, 'vault:read', (path) => `a read ${path}`);
    answer(b as never, 'vault:read', (path) => `b read ${path}`);
    expect(call('vault:read', a, 'One.md')).toBe('a read One.md');
    expect(call('vault:read', b, 'One.md')).toBe('b read One.md');
  });

  it('keeps answering the others when one window closes', () => {
    const a = new FakeWindow();
    const b = new FakeWindow();
    answer(a as never, 'vault:list', () => 'a');
    answer(b as never, 'vault:list', () => 'b');
    a.close();
    expect(() => call('vault:list', a)).toThrow('Not a window Eien knows.');
    expect(call('vault:list', b)).toBe('b');
  });

  it('refuses a call from a page it doesn’t know', () => {
    const a = new FakeWindow();
    answer(a as never, 'vault:notes', () => 'a');
    expect(() => handlers.get('vault:notes')?.({ sender: { id: 9999 } })).toThrow(
      'Not a window Eien knows.',
    );
  });

  it('won’t let one window answer a channel twice', () => {
    const a = new FakeWindow();
    answer(a as never, 'vault:trash', () => 1);
    expect(() => answer(a as never, 'vault:trash', () => 2)).toThrow('answers vault:trash already');
  });
});
