import { afterEach, describe, expect, it } from 'vitest';
import { ago, NEWS_MS, SyncStatus, syncLook } from './sync-status';

const MIN = 60_000;

describe('ago', () => {
  it('says how long, coarsely', () => {
    expect(ago(0, 30_000)).toBe('just now');
    expect(ago(0, 4 * MIN)).toBe('4m ago');
    expect(ago(0, 125 * MIN)).toBe('2h ago');
    expect(ago(0, 3 * 24 * 60 * MIN)).toBe('3d ago');
  });
});

describe('syncLook', () => {
  it('shows nothing for a vault Syncthing doesn’t sync', () => {
    expect(syncLook(false, 0, 1)).toEqual({ shown: false, other: false, tip: '' });
  });

  it('is quiet with nothing from elsewhere yet', () => {
    expect(syncLook(true, null, 1)).toEqual({
      shown: true,
      other: false,
      tip: 'Synced · Syncthing',
    });
  });

  it('says another device changed a note, for a while, then is quiet again', () => {
    const at = 1_000_000;
    expect(syncLook(true, at, at + 4 * MIN)).toEqual({
      shown: true,
      other: true,
      tip: 'Changed on another device 4m ago',
    });
    expect(syncLook(true, at, at + NEWS_MS + MIN).other).toBe(false);
    expect(syncLook(true, at, at + NEWS_MS + MIN).tip).toBe('Synced · Syncthing, 16m ago');
  });
});

describe('SyncStatus', () => {
  afterEach(() => document.body.replaceChildren());

  it('isn’t drawn at all for a vault Syncthing doesn’t sync', () => {
    const slot = document.body.appendChild(document.createElement('span'));
    const status = new SyncStatus(slot, false);
    status.changedElsewhere();
    expect(slot.childElementCount).toBe(0);
  });

  it('draws the icon, named for what it says, and turns pencil after a change elsewhere', () => {
    let now = 5 * MIN;
    const slot = document.body.appendChild(document.createElement('span'));
    const status = new SyncStatus(slot, true, () => now);
    const mark = slot.querySelector<HTMLElement>('.sync-status');
    expect(mark?.getAttribute('aria-label')).toBe('Synced · Syncthing');
    expect(mark?.querySelector('svg.icon')).not.toBeNull();
    status.changedElsewhere();
    expect(mark?.classList.contains('is-other')).toBe(true);
    now += 2 * MIN;
    mark?.dispatchEvent(new Event('pointerenter'));
    expect(mark?.dataset.tip).toBe('Changed on another device 2m ago');
    now += NEWS_MS;
    status.draw();
    expect(mark?.classList.contains('is-other')).toBe(false);
    expect(slot.querySelectorAll('.sync-status')).toHaveLength(1);
  });
});
