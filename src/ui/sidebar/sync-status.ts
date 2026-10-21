// The sync status at the sidebar's foot (backlog #10): a sync icon, with a
// tooltip, when Syncthing syncs the vault, and nothing at all when it doesn't.
// In the added ink while things are quiet: "Synced · Syncthing". In pencil
// for a while after a note changed on another device: "Changed on another
// device 4m ago". Eien only listens: it never starts a sync, and nothing it
// does here writes.

import { h } from '../dom';
import { icon } from '../icons';

/** How long a change from elsewhere is news, in pencil, before the status is quiet again. */
export const NEWS_MS = 15 * 60_000;

export interface SyncLook {
  readonly shown: boolean;
  /** A note changed on another device lately. */
  readonly other: boolean;
  readonly tip: string;
}

/** "just now", "4m ago", "2h ago", "3d ago": how long since `then`. */
export function ago(then: number, now: number): string {
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

/** What the status shows, for a vault Syncthing does or doesn't sync, whose last change from elsewhere came at `other`. */
export function syncLook(syncthing: boolean, other: number | null, now: number): SyncLook {
  if (!syncthing) return { shown: false, other: false, tip: '' };
  if (other !== null && now - other < NEWS_MS)
    return { shown: true, other: true, tip: `Changed on another device ${ago(other, now)}` };
  return {
    shown: true,
    other: false,
    tip: other === null ? 'Synced · Syncthing' : `Synced · Syncthing, ${ago(other, now)}`,
  };
}

export class SyncStatus {
  readonly #slot: HTMLElement;
  readonly #syncthing: boolean;
  readonly #now: () => number;
  #other: number | null = null;
  readonly #mark = h('span', {
    class: 'sync-status',
    attrs: { role: 'img', 'data-tip-side': 'up' },
  });

  /** In `slot` (the foot's), for a vault Syncthing does or doesn't sync. */
  constructor(slot: HTMLElement, syncthing: boolean, now: () => number = Date.now) {
    this.#slot = slot;
    this.#syncthing = syncthing;
    this.#now = now;
    this.#mark.append(icon('sync'));
    // The time in its words is now's, whenever it's looked at.
    this.#mark.addEventListener('pointerenter', () => this.draw());
    this.draw();
  }

  /** A note changed on another device: the status says so. */
  changedElsewhere(): void {
    this.#other = this.#now();
    this.draw();
  }

  draw(): void {
    const look = syncLook(this.#syncthing, this.#other, this.#now());
    if (!look.shown) {
      this.#mark.remove();
      return;
    }
    if (this.#mark.parentElement !== this.#slot) this.#slot.append(this.#mark);
    this.#mark.classList.toggle('is-other', look.other);
    this.#mark.dataset.tip = look.tip;
    this.#mark.setAttribute('aria-label', look.tip);
  }
}
