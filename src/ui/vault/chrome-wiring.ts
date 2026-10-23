// The layout's controls (../chrome) for a shown vault: the slots they're
// drawn in, how each command looks now (a view chosen, Focus on, the list
// shut, Compare showing the changes), the commands the window runs itself,
// and the layout drawn again when the setting changes.

import { type FormatCommandId, headingLevel, nextHeading } from '../../core/format';
import { Chrome } from '../chrome/chrome';
import { type CommandId, commandOf, type LocalCommandId } from '../chrome/commands';
import type { CommandLook } from '../chrome/host';
import { PHONE_TAGS } from '../chrome/layout-spec';
import { LAYOUT_SPECS } from '../chrome/layouts';
import { rememberStrip, stripShut } from '../chrome/strip';
import { tooltips } from '../chrome/tooltip';
import { h } from '../dom';
import type { MenuBus } from '../menu/menu-bus';
import type { SettingsState } from '../settings/settings-state';
import type { PaneLayout } from '../shell/panes';
import type { Sidebar } from '../sidebar/sidebar';
import { COMPARE_WORD } from '../versions/seal-line';
import type { Pages } from './pages';
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
}

export interface VaultChrome {
  /** Draw the layout chosen: once the pages' parts are made. */
  mount(): void;
  /** Show every command as it is now. */
  refresh(): void;
  stop(): void;
}

const NAMES = { live: 'Live', source: 'Source', reading: 'Reading' } as const;
const night = matchMedia('(prefers-color-scheme: dark)');

export function vaultChrome(of: VaultChromeOf): VaultChrome {
  const { shell, pages, panes, settings } = of;
  const { pane } = pages;
  /** The page the controls act on, as each is asked how it looks. */
  const page = () => pages.active.page;
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

  const isNight = () => {
    const scheme = settings.values['appearance.scheme'];
    return scheme === 'night' || (scheme === 'system' && night.matches);
  };
  const two = () => settings.values['layout.panes'] === 'two';
  const barShown = () => settings.values['editor.formatBar'] === 'on';

  /** What's on at the caret, read once for all the bar's buttons (the editor's state the key). */
  let formatsFor: { state: unknown; on: ReadonlySet<FormatCommandId> } | null = null;
  const formatsOn = () => {
    const { editor } = page();
    const state = editor.view.state;
    if (formatsFor?.state !== state) formatsFor = { state, on: editor.formats };
    return formatsFor.on;
  };
  /** A formatting command's look: pressed where its format is on, off where there's nothing to format. */
  const formatLook = (id: CommandId): CommandLook => {
    const { writable, mode, editor } = page();
    if (!writable || mode === 'reading') return { disabled: true, pressed: false };
    if (id === 'format.heading') return { pressed: headingLevel(editor.caretLine) > 0 };
    // In a table, the caret's menus; elsewhere it puts a table in.
    if (id === 'format.table') {
      const inTable = editor.inTable;
      return {
        pressed: inTable,
        tip: inTable ? 'Table: this row’s and column’s menus' : undefined,
      };
    }
    const sends = commandOf(id).sends ?? '';
    return { pressed: formatsOn().has(sends.slice('format:'.length) as FormatCommandId) };
  };

  const look = (id: CommandId): CommandLook => {
    const { versions } = pages.active;
    const { mode } = page();
    switch (id) {
      case 'pane.sidebar': {
        const shut = panes.isShut('sidebar');
        return { pressed: !shut, tip: shut ? 'Show the sidebar' : 'Hide the sidebar' };
      }
      case 'pane.list': {
        const shut = panes.isShut('list');
        if (panes.two)
          return { disabled: true, tip: 'Off with two panes: the sidebar lists the notes' };
        return { pressed: !shut, tip: shut ? 'Show the note list' : 'Hide the note list' };
      }
      case 'view.live':
      case 'view.source':
      case 'view.reading':
        return { pressed: mode === id.slice('view.'.length) };
      case 'view.next':
        return { icon: mode, tip: `${NAMES[mode]} · next view` };
      case 'compare': {
        const word = COMPARE_WORD[versions.compareMode];
        if (!versions.canCompare)
          return { disabled: true, pressed: false, tip: 'No versions to compare yet' };
        return { pressed: word !== '', tip: word ? `Compare · ${word}` : undefined };
      }
      case 'versions':
        return { pressed: versions.panelOpen };
      case 'focus':
        return { pressed: settings.values['editor.focus'] === 'on' };
      case 'format-bar':
        return {
          pressed: barShown(),
          tip: barShown() ? 'Hide the formatting bar' : 'Show the formatting bar',
        };
      case 'strip': {
        const slip = chrome.layout === 'slip';
        return {
          icon: slip ? (strip ? 'left' : 'right') : strip ? 'down' : 'up',
          tip: strip ? 'Show the controls' : 'Hide the controls',
          pressed: undefined,
        };
      }
      case 'scheme':
        return {
          icon: isNight() ? 'moon' : 'sun',
          pressed: isNight(),
          tip: isNight() ? 'Night · switch to day' : 'Day · switch to night',
        };
      case 'panes':
        return {
          icon: two() ? 'panes2' : 'panes3',
          pressed: two(),
          tip: two() ? 'Two panes · switch to three' : 'Three panes · switch to two',
        };
      default:
        return id.startsWith('format.') ? formatLook(id) : {};
    }
  };

  /** The commands that send no menu command: one each, or the types say which is missing. */
  const local: Record<LocalCommandId, (opener: HTMLElement) => void> = {
    strip: () => {
      strip = !strip;
      rememberStrip(strip);
      shell.toggleAttribute('data-strip-shut', strip);
    },
    // Day or night, whichever isn't showing; System stays in Settings.
    scheme: () =>
      void settings.set('appearance.scheme', isNight() ? 'day' : 'night').catch(console.error),
    panes: () => void settings.set('layout.panes', two() ? 'three' : 'two').catch(console.error),
    more: (opener) => of.phone.more(opener),
    // The bar's one heading control: the caret's line a level down each press.
    'format.heading': () => of.menu.run(`format:${nextHeading(page().editor.caretLine)}`),
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
    send: (command) => of.menu.run(command),
    lost: () => page().focus(),
    watch: (host) => tips.watch(host),
    pager: pane.pager,
  });
  tips.watch(pane.divider);
  /** Each page's own controls with tooltips (its tags' +, a table's grips, its ×): watched once, as it's made. */
  const watched = new WeakSet<object>();
  const watchPages = () => {
    for (const { page } of pages.sides) {
      if (watched.has(page)) continue;
      watched.add(page);
      tips.watch(page.tags.set.element);
      // A table's grips and + (in the editor's shadow root, so watched there), and a phone's table bar.
      tips.watch(page.editor.tableTools);
      tips.watch(page.tableBar.element);
      tips.watch(page.closer);
    }
  };
  /** The bar shown or not, as the setting says; the tags where the layout (or a phone) puts them. */
  const place = () => {
    const shown = barShown();
    if (pane.slots.format.hidden === shown) pane.slots.format.hidden = !shown;
    shell.toggleAttribute('data-format-bar', shown);
    const layout = chrome.layout ?? settings.values['appearance.layout'];
    const tags = of.phone.stack.phone ? PHONE_TAGS : LAYOUT_SPECS[layout].tags;
    for (const { page } of pages.sides) page.tags.place(page.tagSlots, tags);
  };
  const refresh = () => {
    if (!mounted) return;
    watchPages();
    place();
    chrome.refresh();
  };
  const stopSettings = settings.onChange((values) => {
    if (!mounted) return;
    chrome.mount(values['appearance.layout']); // nothing when it's the same
    refresh();
  });
  // The caret moved: the bar's buttons show what's on there, once a frame, and only while it shows.
  let frame = 0;
  const stopCaret = pages.onCaret(() => {
    if (!mounted || !barShown() || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      chrome.refresh();
    });
  });
  // A command from the menu bar or a key (⌘E, ⇧⌘↵): its control shows it, once it's run.
  const stopMenu = of.menu.on(() => queueMicrotask(refresh));
  night.addEventListener('change', refresh);
  return {
    mount: () => {
      mounted = true;
      chrome.mount(settings.values['appearance.layout']);
      refresh();
    },
    refresh,
    stop: () => {
      tips.stop();
      stopSettings();
      stopCaret();
      cancelAnimationFrame(frame);
      stopMenu();
      night.removeEventListener('change', refresh);
      chrome.unmount();
    },
  };
}
