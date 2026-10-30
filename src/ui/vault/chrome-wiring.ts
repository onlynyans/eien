// The layout's controls (../chrome) for a shown vault: the slots they're
// drawn in, how each command looks now (./command-looks.ts), the commands
// the window runs itself, the layout drawn again when the setting changes,
// the quick look its Look control opens (./look-wiring.ts), and the menu
// bar's commands greyed by the kind of page in front.

import { nextHeading } from '../../core/format';
import type { MenuCommand } from '../../platform/bridge';
import { Chrome } from '../chrome/chrome';
import { type CommandId, type LocalCommandId, menuOff } from '../chrome/commands';
import type { CommandLook } from '../chrome/host';
import { PHONE_TAGS } from '../chrome/layout-spec';
import { LAYOUT_SPECS } from '../chrome/layouts';
import { rememberStrip, stripShut } from '../chrome/strip';
import { tooltips } from '../chrome/tooltip';
import { h } from '../dom';
import type { MenuBus } from '../menu/menu-bus';
import type { PageKind } from '../page/page-leaf';
import type { SettingsState } from '../settings/settings-state';
import type { PaneLayout } from '../shell/panes';
import type { Sidebar } from '../sidebar/sidebar';
import { commandLooks, isNight } from './command-looks';
import { lookWiring } from './look-wiring';

import { pageHosts } from './page-hosts';
import { pageMore } from './page-more';
import { isNote, type Pages, type Side } from './pages';
import type { PhoneView } from './phone-view';

export interface VaultChromeOf {
  readonly shell: HTMLElement;
  /** The pane's slots, and the active page the controls act on. */
  readonly pages: Pages;
  readonly sidebar: Sidebar;
  readonly panes: PaneLayout;
  readonly phone: PhoneView;
  readonly settings: SettingsState;
  readonly menu: MenuBus;
  readonly mac: boolean;
  /** The system's name: what the quick look offers here, as Settings does. */
  readonly platform: string;
  /** A note in a window of its own: the desktop's only (a companion's ⋯ offers it). */
  readonly openInNewWindow?: (path: string) => void;
  /** The menu bar's commands that do nothing now, greyed: the desktop's only (#40). */
  readonly greyMenu?: (commands: readonly MenuCommand[]) => void;
}

export interface VaultChrome {
  /** Draw the layout chosen: once the pages' parts are made. */
  mount(): void;
  /** Show every command as it is now. */
  refresh(): void;
  stop(): void;
}

const night = matchMedia('(prefers-color-scheme: dark)');

export function vaultChrome(of: VaultChromeOf): VaultChrome {
  const { shell, pages, panes, settings } = of;
  const { pane } = pages;
  /** The page the controls act on, as each is asked how it looks. */
  const page = () => pages.active.page;
  /** The active page's note's, for the formatting bar: the caret's. */
  const notePage = () => pages.activeNote?.page ?? null;
  const slots = {
    top: pane.head,
    pageBar: pane.slots.bar,
    format: pane.slots.format,
    sidebarChevron: h('div', { class: 'chevron-slot chevron-slot--sidebar' }),
    listChevron: h('div', { class: 'chevron-slot chevron-slot--list' }),
    foot: of.sidebar.foot.controls,
    phoneBar: of.phone.stack.controls,
    phoneFoot: pane.slots.phone,
  };
  shell.append(slots.top, slots.sidebarChevron, slots.listChevron);
  let strip = stripShut();
  shell.toggleAttribute('data-strip-shut', strip);
  let mounted = false;

  const two = () => settings.values['layout.panes'] === 'two';
  const barShown = () => settings.values['editor.formatBar'] === 'on';

  const sideOf = (element: HTMLElement) =>
    pages.sides.find(({ page }) => page.element.contains(element));
  /** The split the layout's hosts are drawn for: its mode while split, none with one page. */
  const split = () => (pages.split ? pages.mode : null);

  /**
   * The page a layout control acts on: the active one, or with a companion
   * the page itself, the formatting bar still the caret's (../chrome/splits.ts).
   */
  const target = (id: CommandId): Side =>
    split()?.toolsFor === 'first' && !id.startsWith('format')
      ? (pages.sides[0] ?? pages.active)
      : pages.active;
  const looks = commandLooks({
    panes,
    settings,
    layout: () => chrome.layout,
    strip: () => strip,
    lookOpen: () => quick.isOpen,
  });
  /** How `id` looks now, for `side`'s page (a page's own host), else the page it acts on. */
  const look = (id: CommandId, side: Side = target(id)): CommandLook => looks(id, side);

  /** The commands that send no menu command: one each, or the types say which is missing. */
  const local: Record<LocalCommandId, (opener: HTMLElement) => void> = {
    strip: () => {
      strip = !strip;
      rememberStrip(strip);
      shell.toggleAttribute('data-strip-shut', strip);
    },
    // Day or night, whichever isn't showing; System stays in Settings.
    scheme: () =>
      void settings
        .set('appearance.scheme', isNight(settings) ? 'day' : 'night')
        .catch(console.error),
    panes: () => void settings.set('layout.panes', two() ? 'three' : 'two').catch(console.error),
    more: (opener) => of.phone.more(opener),
    // The bar's one heading control: the caret's line a level down each press.
    'format.heading': () => {
      const on = notePage();
      if (on) of.menu.run(`format:${nextHeading(on.editor.caretLine)}`);
    },
    // A page's own ×, and a companion's ⋯: the page it's on.
    'page.close': (opener) => {
      const side = sideOf(opener);
      if (side) pages.close(side);
    },
    'page.more': (opener) => {
      const side = sideOf(opener);
      if (side && isNote(side)) pageMore({ ...of, run: (c) => of.menu.run(c) }, side, opener);
    },
  };

  const tips = tooltips();
  // The sidebar's quiet + buttons have their tooltips too: watched alone, never the whole tree.
  for (const adder of of.sidebar.adders) tips.watch(adder);
  tips.watch(of.sidebar.foot.sync);
  // The lens's controls: in the list's head (its rows drawn only in sight, so the pane is cheap
  // to watch), and with two panes in the sidebar's lens.
  tips.watch(of.sidebar.lens.tools);
  tips.watch(of.sidebar.lens.chips);
  const listPane = of.shell.querySelector<HTMLElement>('.list');
  if (listPane) tips.watch(listPane);
  const chrome = new Chrome({
    mac: of.mac,
    slots,
    look,
    local: (id, opener) => local[id](opener),
    send: (command, id) => {
      pages.activate(target(id)); // the page it acts on is the one the command runs for
      of.menu.run(command);
    },
    lost: () => page().focus(),
    watch: (host) => tips.watch(host),
    pager: pane.pager,
    phone: () => of.phone.stack.phone,
  });
  tips.watch(pane.divider);

  const quick = lookWiring({
    pages,
    settings,
    menu: of.menu,
    platform: of.platform,
    mac: of.mac,
    phone: () => of.phone.stack.phone,
    target: () => target('look'),
    // With the band or slip put away, under the strip's control, the way back to them.
    opener: () => chrome.inSight('look') ?? chrome.inSight('strip') ?? null,
    changed: () => chrome.refresh(),
  });
  const own = pageHosts({
    pages,
    mac: of.mac,
    look,
    press: (id, opener) => chrome.press(id, opener),
    watch: (host) => tips.watch(host),
  });
  /** Each page's own controls with tooltips (its ×, a note's tags' +): watched once, as it's made. */
  const watched = new WeakSet<object>();
  const watchPages = () => {
    for (const { page } of pages.sides) {
      if (watched.has(page)) continue;
      watched.add(page);
      for (const part of page.tipped) tips.watch(part);
    }
  };
  /**
   * The bar shown or not, as the setting says, while a page holds a note (#40): beside a book
   * it stays, its note-only buttons set aside, so neither page moves; with a book alone it goes.
   * The tags where the layout (or a phone) puts them.
   */
  const place = () => {
    const shown = barShown() && pages.sides.some(isNote);
    if (pane.slots.format.hidden === shown) pane.slots.format.hidden = !shown;
    shell.toggleAttribute('data-format-bar', shown);
    const layout = chrome.layout ?? settings.values['appearance.layout'];
    const tags = of.phone.stack.phone ? PHONE_TAGS : LAYOUT_SPECS[layout].tags;
    // Where each note's figures are at its page's foot, C's tags go to the page's own head.
    // C's tags are the colophon's: a page whose figures are at its own foot has them at its own head.
    const figures = split()?.figures ?? 'active';
    pages.sides.forEach((side, index) => {
      if (!isNote(side)) return;
      const own = figures === 'pages' || (figures === 'second' && index === 1);
      side.page.tags.place(side.page.tagSlots, own && tags === 'colophon' ? 'runningHead' : tags);
    });
  };
  /** The kind of page the menu bar's commands last greyed for. */
  let greyedFor: PageKind | null = null;
  const greyMenu = () => {
    const { kind } = pages.active;
    if (kind === greyedFor) return;
    greyedFor = kind;
    of.greyMenu?.(menuOff(kind));
  };
  const refresh = () => {
    if (!mounted) return;
    greyMenu();
    quick.refresh();
    chrome.mount(settings.values['appearance.layout'], split()); // nothing when it's the same
    own.sync();
    watchPages();
    place();
    chrome.refresh();
    own.refresh();
  };
  const stopSettings = settings.onChange(() => refresh());
  // The caret moved: the bar's buttons show what's on there, once a frame, and only while it shows.
  let frame = 0;
  const stopCaret = pages.onCaret(() => {
    if (!mounted || !barShown() || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      chrome.refresh();
      own.refresh();
    });
  });
  // A command from the menu bar or a key (⌘E, ⇧⌘↵): its control shows it, once it's run.
  const stopMenu = of.menu.on(() => queueMicrotask(refresh));
  night.addEventListener('change', refresh);
  return {
    mount: () => {
      mounted = true;
      refresh();
    },
    refresh,
    stop: () => {
      tips.stop();
      stopSettings();
      stopCaret();
      cancelAnimationFrame(frame);
      stopMenu();
      quick.stop();
      of.greyMenu?.([]); // a vault no longer shown greys nothing (Open Vault…, the welcome)
      night.removeEventListener('change', refresh);
      chrome.unmount();
    },
  };
}
