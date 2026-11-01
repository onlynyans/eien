// The framework's promise (docs/design/explorations/overall.md): commands are
// defined once, and each layout draws every one it offers in exactly one
// host, so switching layouts loses none.

import { describe, expect, it } from 'vitest';
import { findKey, findLabel } from '../../core/find';
import { FORMAT_COMMANDS } from '../../core/format';
import { ICONS } from '../icons';
import { COMMANDS, type CommandId, commandOf, LAYOUTS, onDesktopIn } from './commands';
import { keysOf, keyText } from './keys';
import { idsIn, TOOL_FOLDS } from './layout-spec';
import { LAYOUT_SPECS } from './layouts';
import { SPLIT_SPECS, type SplitMode, splitHosts } from './splits';

const sorted = (ids: readonly string[]) => [...ids].sort();
const desktopIds = (layout: (typeof LAYOUTS)[number]) =>
  LAYOUT_SPECS[layout].desktop.flatMap((host) => idsIn(host.items));

describe('the commands', () => {
  it('are each defined once', () => {
    const ids = COMMANDS.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each have an icon Eien draws, or are the seal', () => {
    for (const command of COMMANDS) {
      expect(command.icon === 'seal' || command.icon in ICONS, command.id).toBe(true);
    }
  });

  it('each run a menu command, or are among the few the window runs itself', () => {
    const local = COMMANDS.filter((command) => !('sends' in command)).map((command) => command.id);
    expect(sorted(local)).toEqual([
      'format.heading',
      'marks',
      'more',
      'page.close',
      'page.more',
      'panes',
      'scheme',
      'strip',
    ]);
  });

  it('are each drawn in some layout, or by some split', () => {
    const drawn = new Set([
      ...LAYOUTS.flatMap((layout) => [
        ...desktopIds(layout),
        ...idsIn(LAYOUT_SPECS[layout].phone.items),
      ]),
      ...Object.values(SPLIT_SPECS).flatMap((split) => [...split.own.items, ...split.tools]),
    ]);
    expect(sorted([...drawn])).toEqual(sorted(COMMANDS.map((command) => command.id)));
  });

  it('give Find the find bar’s own name and key, so its tooltip says what Edit → Find answers to (#64)', () => {
    const find = commandOf('find');
    expect(find.label).toBe(findLabel('find'));
    for (const mac of [true, false])
      expect(keysOf(find, mac)?.text, String(mac)).toBe(keyText(findKey('find', mac), mac));
    expect(keysOf(find, true)).toEqual({ text: '⌘F', aria: 'Meta+F' });
  });
});

describe.each(LAYOUTS)('the %s layout', (layout) => {
  const spec = LAYOUT_SPECS[layout];

  it('names one of its own hosts as the page’s tools (where a split adds to, and its pager goes)', () => {
    expect(spec.desktop.map((host) => host.name)).toContain(spec.tools);
  });

  it('draws every command its desktop offers in exactly one host', () => {
    const offered = COMMANDS.filter((command) => onDesktopIn(command, layout));
    expect(sorted(desktopIds(layout))).toEqual(sorted(offered.map((command) => command.id)));
  });

  it('draws no phone-only command on the desktop', () => {
    expect(desktopIds(layout).filter((id) => commandOf(id).phone)).toEqual([]);
  });

  it('draws a book’s every tool in every room: its phone’s bar and its desktop’s (#63)', () => {
    const book = COMMANDS.filter((command) => 'on' in command && command.on === 'epub');
    expect(book.length).toBeGreaterThan(0);
    for (const { id } of book) {
      expect(idsIn(spec.phone.items), id).toContain(id);
      expect(desktopIds(layout), id).toContain(id);
    }
  });

  it('gives a phone Focus mode (#30) and the ⋯ that reaches the rest, each once', () => {
    const phone = idsIn(spec.phone.items);
    expect(new Set(phone).size).toBe(phone.length);
    expect(phone).toContain('focus');
    expect(phone).toContain('more');
  });

  it('names each host, and gives each another icon only for a command it holds', () => {
    for (const host of [...spec.desktop, spec.phone]) {
      expect(host.label, host.name).not.toBe('');
      const held = new Set<CommandId>(idsIn(host.items));
      for (const [id, name] of Object.entries(host.icons ?? {})) {
        expect(held.has(id as CommandId), `${host.name}: ${id}`).toBe(true);
        expect(name in ICONS).toBe(true);
      }
    }
  });

  it('keeps the day-or-night, panes and settings controls at the sidebar’s foot (#8)', () => {
    const foot = spec.desktop.filter((host) => host.slot === 'foot').flatMap((h) => idsIn(h.items));
    expect(foot).toEqual(['scheme', 'panes', 'settings']);
  });

  it('puts Focus mode, and the formatting bar’s switch, in the page’s toolbar (#30, #14)', () => {
    const page = spec.desktop.filter((host) => host.slot === 'pageBar' || host.slot === 'top');
    expect(page.flatMap((host) => idsIn(host.items))).toContain('focus');
    expect(page.flatMap((host) => idsIn(host.items))).toContain('format-bar');
  });

  it('draws the formatting bar in its own row: every Format menu command, the headings as one', () => {
    const bar = spec.desktop.filter((host) => host.slot === 'format');
    expect(bar).toHaveLength(1);
    const ids = idsIn(bar[0]?.items ?? []);
    const formats = FORMAT_COMMANDS.map((command) =>
      command.id.startsWith('heading') ? 'format.heading' : `format.${command.id}`,
    );
    expect(sorted(ids)).toEqual(sorted([...new Set(formats)]));
    for (const id of ids) {
      const command = commandOf(id);
      const menu = FORMAT_COMMANDS.find((each) => `format:${each.id}` === command.sends);
      if (menu) expect(command.key, id).toBe(menu.key); // the menu's own key
    }
  });
});

describe('the Look control (#49)', () => {
  it('is the page’s last tool after a hairline in each layout, before only the strip', () => {
    for (const layout of LAYOUTS) {
      const spec = LAYOUT_SPECS[layout];
      const items = spec.desktop.find((host) => host.name === spec.tools)?.items ?? [];
      const at = items.indexOf('look');
      expect(items[at - 1], layout).toBe('|');
      expect(items.slice(at + 1), layout).toEqual(layout === 'runhead' ? [] : ['strip']);
    }
  });

  it('is in every phone layout’s tools, before the ⋯ that offers it too', () => {
    for (const layout of LAYOUTS) {
      const phone = idsIn(LAYOUT_SPECS[layout].phone.items);
      expect(phone.slice(-2), layout).toEqual(['look', 'more']);
    }
  });

  it('folds last of the tools, before the views', () => {
    const at = TOOL_FOLDS.indexOf('look');
    // Find (#64) just before it, a book's bookmark (#40, Phase 4b) and its Marks before that.
    expect(TOOL_FOLDS.slice(at - 4, at)).toEqual(['focus', 'marks', 'bookmark', 'find']);
    expect(TOOL_FOLDS[at + 1]).toBe('view.live');
  });

  it('runs the quick look’s menu command, with its key, for a page of any kind (#40)', () => {
    expect(commandOf('look')).toMatchObject({
      icon: 'look',
      label: 'Look',
      key: 'Mod-Shift-l',
      sends: 'look',
    });
    expect(commandOf('look')).not.toHaveProperty('on');
    const keys = COMMANDS.map((command) => ('key' in command ? command.key : undefined));
    expect(keys.filter((key) => key?.toLowerCase() === 'mod-shift-l')).toHaveLength(1);
  });
});

describe('switching layouts', () => {
  it('moves the tags’ place as each design has it: A’s running head, B’s title, C’s colophon', () => {
    expect(LAYOUTS.map((layout) => LAYOUT_SPECS[layout].tags)).toEqual([
      'runningHead',
      'underTitle',
      'colophon',
    ]);
  });

  it('loses no command: each layout offers the same ones, but the strip only one that hides', () => {
    const offered = (layout: (typeof LAYOUTS)[number]) => new Set(desktopIds(layout));
    for (const command of COMMANDS) {
      if (commandOf(command.id).phone || commandOf(command.id).split) continue;
      for (const layout of LAYOUTS) {
        const expected = command.id !== 'strip' || layout !== 'runhead';
        expect(offered(layout).has(command.id), `${layout}: ${command.id}`).toBe(expected);
      }
    }
  });

  it('keeps C’s pane toggles in sight in its running head, and A’s and B’s at the panes’ edges', () => {
    const slotOf = (layout: (typeof LAYOUTS)[number], id: CommandId) =>
      LAYOUT_SPECS[layout].desktop.find((host) => idsIn(host.items).includes(id))?.slot;
    expect(slotOf('runhead', 'pane.sidebar')).toBe('top');
    expect(slotOf('band', 'pane.sidebar')).toBe('sidebarChevron');
    expect(slotOf('slip', 'pane.list')).toBe('listChevron');
  });
});

const MODES = Object.keys(SPLIT_SPECS) as SplitMode[];

describe.each(LAYOUTS.flatMap((layout) => MODES.map((mode) => [layout, mode] as const)))(
  'the %s layout, split as %s',
  (layout, mode) => {
    const split = SPLIT_SPECS[mode];
    const hosts = splitHosts(LAYOUT_SPECS[layout], split);
    const ids = hosts.flatMap((host) => idsIn(host.items));

    it('draws every command once: in the layout’s hosts, or on each page’s own', () => {
      const offered = COMMANDS.filter((command) => onDesktopIn(command, layout)).map(
        (command) => command.id as CommandId,
      );
      const kept = offered.filter((id) => !split.own.items.includes(id));
      expect(sorted(ids)).toEqual(sorted([...kept, ...split.tools]));
      // What a page holds for itself was the layout's, or is the split's own (a page's ×).
      for (const id of split.own.items)
        expect(commandOf(id).split || offered.includes(id), id).toBeTruthy();
    });

    it('leaves no rule first, last, or beside another in a host', () => {
      for (const host of hosts) {
        const items = host.items;
        expect(items[0], host.name).not.toBe('|');
        expect(items.at(-1), host.name).not.toBe('|');
        expect(
          items.some((item, at) => item === '|' && items[at + 1] === '|'),
          host.name,
        ).toBe(false);
      }
    });

    it('draws nothing a page holds for itself in the layout’s hosts', () => {
      expect(ids.filter((id) => split.own.items.includes(id))).toEqual([]);
    });
  },
);
