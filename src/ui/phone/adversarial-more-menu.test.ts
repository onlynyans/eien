// Adversarial: the phone's ⋯ (phase 10b) against the counters it reads. The
// counters build a few elements (h(): createElement, textContent) and keep a
// sprint in localStorage: small stand-ins play both, as in
// ../counters/adversarial-counters.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS, type SettingValues } from '../../core/config';
import { Counters } from '../counters/counters';
import { moreItems } from './more-menu';

class FakeElement {
  textContent = '';
  className = '';
  readonly children: unknown[] = [];
  setAttribute(): void {}
  removeAttribute(): void {}
  addEventListener(): void {}
  append(...nodes: unknown[]): void {
    this.children.push(...nodes);
  }
}

beforeEach(() => {
  const items = new Map<string, string>();
  vi.stubGlobal('document', { createElement: () => new FakeElement() });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, String(value)),
    removeItem: (key: string) => void items.delete(key),
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const values = Object.fromEntries(
  SETTINGS.map((setting) => [setting.key, setting.default]),
) as unknown as SettingValues;

const labels = (counters: Counters) =>
  moreItems({ values, sprinting: counters.sprinting, exportTo: () => {} }, () => {}).flatMap(
    (item) => (item === 'separator' ? [] : [item.label]),
  );

describe('the ⋯ menu’s sprint', () => {
  it('offers another sprint once the last is over', () => {
    // Counters.sprinting is true for a sprint that's over and still shown ("Sprint done +250"),
    // and stays so for the rest of the session. The ⋯ then offers only Stop sprint: the writer
    // who finished a sprint at nine and wants another at five finds no sprint to start, unless
    // they think to stop the one already over first. The desktop's menu always offers both.
    vi.setSystemTime(new Date(2026, 9, 20, 9));
    const counters = new Counters({ tell: () => {} });
    counters.startSprint(10);
    expect(labels(counters)).toContain('Stop sprint'); // under way: Stop, not another
    vi.advanceTimersByTime(8 * 60 * 60_000); // over at 9:10; it's 5 in the afternoon
    expect(labels(counters)).toContain('Sprint, 10 minutes');
    counters.stop();
  });
});
