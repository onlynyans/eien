// Where a folder lands after a move (#40): moved into another folder, that
// one opens on SHELF; moved among its own, a fold the writer made there stays.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sidebar } from '../sidebar/sidebar';
import { Navigation } from './navigation';
import { type OrderActionsOf, orderActions } from './order-actions';

beforeEach(() => localStorage.clear());

function actions() {
  const nav = new Navigation();
  const refocusOn = vi.fn();
  const order = orderActions({
    nav,
    sidebar: () => ({ refocusOn }) as unknown as Sidebar,
    act: async (operation: () => Promise<unknown>) => void (await operation()),
  } as unknown as OrderActionsOf);
  return { nav, order, refocusOn };
}

describe('a folder landing', () => {
  it('leaves SHELF’s folds alone when it moves among its own', () => {
    const { nav, order, refocusOn } = actions();
    nav.shelf.set('Reading', true);
    order.land('Reading/Novels', 'Reading/Novels');
    expect(nav.shelf.shut).toEqual(['Reading']);
    expect(refocusOn).toHaveBeenCalledWith('Reading/Novels');
  });

  it('opens on SHELF the folder it moved into, and those it’s in', () => {
    const { nav, order } = actions();
    for (const path of ['Reading', 'Reading/Shelved', 'Zines']) nav.shelf.set(path, true);
    order.land('Novels', 'Reading/Shelved/Novels');
    expect(nav.shelf.shut).toEqual(['Zines']);
  });
});
