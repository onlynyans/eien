// The window's back (#70): the settings close first, then the vault goes
// back; a desktop's back is a trackpad's gesture (no Esc), a phone's is
// Android's; two fingers read from the wheel only where the system says so.

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { DEFAULT_SETTINGS, type SettingValues } from '../core/config';
import type { Bridge, MenuCommand } from '../platform/bridge';

const shownBack = vi.fn<(gesture: boolean) => boolean>();
vi.mock('./vault/vault-view', () => ({
  showVault: async () => ({
    back: shownBack,
    stop: async () => {},
    flush: async () => {},
    notePath: () => null,
    openNote: async () => {},
  }),
}));

const { startApp } = await import('./app');

interface Started {
  readonly back: () => boolean;
  readonly menu: (command: MenuCommand) => void;
}

let root: HTMLElement;
/** The wheel's listeners each start left on the window, taken off after each test. */
let wheels: EventListenerOrEventListenerObject[] = [];
let swipes: Mock<() => Promise<boolean>>;

/** The window started over a vault, on a desktop (with its windows) or a phone. */
async function started(desktop: boolean): Promise<Started> {
  let values: SettingValues = DEFAULT_SETTINGS;
  let back: (() => boolean) | undefined;
  let menu: ((command: MenuCommand) => void) | undefined;
  const bridge = {
    platform: desktop ? 'darwin' : 'android',
    vault: {
      current: async () => ({ name: 'Vault', syncthing: false }),
      onChange: () => () => {},
      listFiles: async () => [],
    },
    settings: {
      read: async () => values,
      set: async (key: string, value: unknown) => {
        values = { ...values, [key]: value };
        return values;
      },
    },
    out: { kinds: [], copy: async () => {}, saveAs: async () => null },
    onMenu: (listener: (command: MenuCommand) => void) => {
      menu = listener;
      return () => {};
    },
    onBack: (handler: () => boolean) => {
      back = handler;
      return () => {};
    },
    onBeforeClose: () => {},
    paintControls: async () => {},
    window: desktop
      ? {
          open: async () => {},
          close: async () => {},
          start: async () => ({ note: null }),
          greyMenu: async () => {},
          swipes,
        }
      : undefined,
  } as unknown as Bridge;
  await startApp(root, bridge);
  if (!back || !menu) throw new Error('the window listens for neither back nor the menu');
  return { back, menu };
}

/** Two fingers swiped back across the window, as a trackpad's wheel events. */
const twoFingersBack = () => {
  for (let step = 0; step < 12; step += 1)
    root.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, deltaX: -20, deltaY: 0, deltaMode: 0 }),
    );
};

beforeEach(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  shownBack.mockReset().mockReturnValue(true);
  swipes = vi.fn(async () => true);
  root = document.createElement('div');
  document.body.append(root);
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'wheel' && listener) wheels.push(listener);
    add(type, listener, options);
  });
});
afterEach(() => {
  for (const listener of wheels) window.removeEventListener('wheel', listener);
  wheels = [];
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('the window’s back (#70)', () => {
  it('on a phone, goes back in the vault as Android’s back, Esc and all', async () => {
    const { back } = await started(false);
    expect(back()).toBe(true);
    expect(shownBack).toHaveBeenCalledExactlyOnceWith(false);
    shownBack.mockReturnValue(false);
    expect(back()).toBe(false);
  });

  it('on a desktop, goes back in the vault as a gesture, pressing no Esc', async () => {
    const { back } = await started(true);
    back();
    expect(shownBack).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('closes the settings first, and the vault stays where it is', async () => {
    const { back, menu } = await started(false);
    menu('settings');
    expect(document.querySelector('dialog')?.open).toBe(true);
    expect(back()).toBe(true);
    expect(shownBack).not.toHaveBeenCalled();
    expect(document.querySelector('dialog')?.open).toBe(false);
  });

  it('reads two fingers across the window as back where the system says they swipe', async () => {
    await started(true);
    await vi.waitFor(() => expect(swipes).toHaveBeenCalled());
    await Promise.resolve();
    twoFingersBack();
    expect(shownBack).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('leaves two fingers to scroll where the system says they don’t swipe', async () => {
    swipes.mockResolvedValue(false);
    await started(true);
    await vi.waitFor(() => expect(swipes).toHaveBeenCalled());
    await Promise.resolve();
    twoFingersBack();
    expect(shownBack).not.toHaveBeenCalled();
  });
});
