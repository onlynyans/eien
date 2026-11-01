// The preload's back (#70): a Mac's three-finger swipe, sent by the main
// process (./swipe-session.ts), runs the window's handlers, newest first.

import { describe, expect, it, vi } from 'vitest';
import type { Bridge } from '../../platform/bridge';

const heard = new Map<string, () => void>();
const invoke = vi.fn(async () => true);
let exposed: Bridge | undefined;
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (_name: string, bridge: Bridge) => {
      exposed = bridge;
    },
  },
  ipcRenderer: {
    on: (channel: string, listener: () => void) => heard.set(channel, listener),
    removeListener: () => {},
    invoke,
    send: () => {},
  },
}));

const { CHANNEL } = await import('../../platform/bridge');
await import('./preload');

/** The main process's back, as a swipe sends it. */
const swipedBack = () => heard.get(CHANNEL.back)?.();

describe('the desktop window’s back (#70)', () => {
  it('runs the window’s handlers on a swipe back, the newest first, until one went back', () => {
    if (!exposed) throw new Error('the preload exposed no bridge');
    const older = vi.fn(() => true);
    const newer = vi.fn(() => true);
    const stopOlder = exposed.onBack(older);
    const stopNewer = exposed.onBack(newer);
    swipedBack();
    expect(newer).toHaveBeenCalledOnce();
    expect(older).not.toHaveBeenCalled();
    stopNewer();
    swipedBack();
    expect(older).toHaveBeenCalledOnce();
    stopOlder();
    swipedBack();
    expect(older).toHaveBeenCalledOnce();
  });

  it('asks the main process whether two fingers swipe', async () => {
    await expect(exposed?.window?.swipes()).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith(CHANNEL.windowSwipes);
  });
});
