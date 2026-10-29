// The quick look (../quick-look) wired to a shown vault: the menu's Look
// (⇧⌘L, View → Look…, the control, a ⋯'s) opens the look of the page the
// layout's tools act on, whose look it is by its kind (the notes', or the
// shelf's, #40); choosing the other page closes it; and while it's open, a
// page of another kind beside it sits back.

import { actsOn } from '../chrome/commands';
import type { MenuBus } from '../menu/menu-bus';
import type { PageKind } from '../page/page-leaf';
import { epubStore } from '../quick-look/epub-store';
import { type LookSubject, QuickLook } from '../quick-look/quick-look';
import type { SettingsState } from '../settings/settings-state';
import type { Pages, Side } from './pages';

export interface LookWiringOf {
  readonly pages: Pages;
  readonly settings: SettingsState;
  readonly menu: MenuBus;
  readonly platform: string;
  readonly mac: boolean;
  /** Whether the window goes the phone's way: the look a sheet. */
  phone(): boolean;
  /** The page the layout's Look acts on: the active one, or a companion's page itself. */
  target(): Side;
  /** What it hangs under: the Look control in sight, else the strip's. */
  opener(): HTMLElement | null;
  /** Opened or closed: the controls show it. */
  changed(): void;
}

export interface LookWiring {
  readonly isOpen: boolean;
  /** The pages changed: closed if the page it's for is no longer the one acted on; the pages sit back or not. */
  refresh(): void;
  stop(): void;
}

export function lookWiring(of: LookWiringOf): LookWiring {
  const { pages, settings } = of;
  /** Whose look each kind of page wears: the notes', and the shelf's, apart (#40). */
  const subjects: Record<PageKind, LookSubject> = {
    note: { crumb: 'Notes', every: 'every note', store: settings },
    epub: {
      crumb: 'Shelf',
      every: 'every book on the shelf',
      store: epubStore(settings),
      // All settings opens Settings at Look, which sets the notes' (epub.md, After Phase 1).
      line: 'Settings sets notes; this is every book’s look.',
    },
  };
  /** The side whose look is open: choosing the other page closes it. */
  let lookSide: Side | null = null;
  /**
   * While the look is open, a page of another kind beside it sits back, as the companion's page
   * you aren't in does: the look doesn't change it (two notes, or two books, wear the one look).
   */
  const sitBack = () => {
    const kind = quick.isOpen && pages.split ? lookSide?.kind : undefined;
    for (const side of pages.sides)
      side.page.element.toggleAttribute('data-back', kind !== undefined && side.kind !== kind);
  };
  const quick = new QuickLook({
    platform: of.platform,
    mac: of.mac,
    window: settings,
    phone: of.phone,
    allSettings: () => of.menu.run('settings:look'),
    changed: () => {
      sitBack();
      of.changed();
    },
  });
  const toggle = () => {
    const side = of.target();
    if (!actsOn('look', side.kind)) return;
    // The page whose look it is becomes the one you're in (a companion's page, by the menu's
    // Look), so the page sitting back is the other one, as the split already has it.
    if (side !== pages.active) pages.activate(side);
    lookSide = side;
    // On the phone's way too: a press on its control is then a toggle, not a close and open again.
    quick.toggle(subjects[side.kind], of.opener());
  };
  const stop = of.menu.on((command) => {
    if (command === 'look') toggle();
  });
  return {
    get isOpen() {
      return quick.isOpen;
    },
    refresh() {
      if (quick.isOpen && lookSide !== of.target()) quick.close();
      sitBack(); // a page closed or opened beside while it's open
    },
    stop() {
      stop();
      quick.close();
    },
  };
}
