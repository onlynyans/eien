// The framework's promise (docs/design/explorations/overall.md): commands are
// defined once, and each layout draws every one it offers in exactly one
// host, so switching layouts loses none.

import { describe, expect, it } from 'vitest';
import { FORMAT_COMMANDS } from '../../core/format';
import { ICONS } from '../icons';
import { COMMANDS, type CommandId, commandOf, LAYOUTS, onDesktopIn } from './commands';
import { idsIn } from './layout-spec';
import { LAYOUT_SPECS } from './layouts';

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
    expect(sorted(local)).toEqual(['format.heading', 'more', 'panes', 'scheme', 'strip']);
  });

  it('are each drawn in some layout', () => {
    const drawn = new Set(
      LAYOUTS.flatMap((layout) => [
        ...desktopIds(layout),
        ...idsIn(LAYOUT_SPECS[layout].phone.items),
      ]),
    );
    expect(sorted([...drawn])).toEqual(sorted(COMMANDS.map((command) => command.id)));
  });
});

describe.each(LAYOUTS)('the %s layout', (layout) => {
  const spec = LAYOUT_SPECS[layout];

  it('draws every command its desktop offers in exactly one host', () => {
    const offered = COMMANDS.filter((command) => onDesktopIn(command, layout));
    expect(sorted(desktopIds(layout))).toEqual(sorted(offered.map((command) => command.id)));
  });

  it('draws no phone-only command on the desktop', () => {
    expect(desktopIds(layout).filter((id) => commandOf(id).phone)).toEqual([]);
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
      if (commandOf(command.id).phone) continue;
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
