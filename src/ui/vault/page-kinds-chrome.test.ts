// A page of another kind and the window's tools (../chrome/commands.ts,
// `on`): a note's commands look disabled where the page they'd act on holds
// something else, and do nothing from the menu; the window's act on any page.
// A stand-in second kind (./stand-in-kind.ts) stands for the EPUB's (backlog #40).

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MenuCommand } from '../../platform/bridge';
import { actsOn, COMMANDS, type CommandId } from '../chrome/commands';
import type { MenuBus } from '../menu/menu-bus';
import type { PaneLayout } from '../shell/panes';
import type { Sidebar } from '../sidebar/sidebar';
import { vaultChrome } from './chrome-wiring';
import { type CommandContext, runCommand } from './commands';
import type { Side } from './pages';
import { pagesWith } from './pages-harness';
import type { PhoneView } from './phone-view';
import { standInKind } from './stand-in-kind';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  localStorage.clear();
});

const NOTE_COMMANDS = COMMANDS.filter((command) => 'on' in command).map(({ id }) => id);

/** The window's tools drawn over `made`'s pages, as the vault view draws them. */
function toolsOver(made: Awaited<ReturnType<typeof pagesWith>>) {
  const { pages } = made;
  const div = () => document.createElement('div');
  const chrome = vaultChrome({
    shell: document.body.appendChild(div()),
    pages,
    sidebar: {
      foot: { controls: div(), sync: div() },
      adders: [],
      lens: { tools: div(), chips: div() },
    } as unknown as Sidebar,
    panes: { isShut: () => false, aside: false, two: false } as unknown as PaneLayout,
    phone: { stack: { controls: div(), phone: false }, more: () => {} } as unknown as PhoneView,
    settings: made.settings,
    menu: { on: () => () => {}, run: () => {} } as unknown as MenuBus,
    mac: false,
  });
  chrome.mount();
  stops.push(() => {
    chrome.stop();
    pages.stop();
  });
  /** Whether each of `ids` drawn in the page's bar is disabled. */
  const disabled = (ids: readonly CommandId[]) =>
    ids.flatMap((id) => {
      const button = pages.pane.slots.bar.querySelector<HTMLButtonElement>(
        `[data-command="${id}"]`,
      );
      return button ? [[id, button.disabled] as const] : [];
    });
  return { chrome, disabled };
}

/** A note on the left, the stand-in beside it (the active one), and the window's tools drawn. */
async function drawn() {
  const files = { 'Chapter.md': 'The gate held.' };
  const made = await pagesWith(files, { 'appearance.layout': 'band' }, [standInKind]);
  await made.pages.open('Chapter.md');
  await made.pages.open('Map.stand', true);
  return { ...made, ...toolsOver(made) };
}

describe('the commands for a note', () => {
  it('are marked so, and act on a note’s page alone', () => {
    expect(NOTE_COMMANDS).toEqual(
      expect.arrayContaining(['view.live', 'compare', 'seal', 'versions', 'format.bold']),
    );
    for (const id of NOTE_COMMANDS) {
      expect(actsOn(id, 'note')).toBe(true);
      expect(actsOn(id, 'epub')).toBe(false);
    }
    expect(actsOn('page.close', 'epub')).toBe(true);
    expect(actsOn('scheme', 'epub')).toBe(true);
  });

  it('look disabled in the layout’s bar while the page they act on holds another kind', async () => {
    const { pages, chrome, disabled } = await drawn();
    const views = ['view.live', 'view.source', 'view.reading', 'compare', 'seal'] as const;
    const shown = disabled(views);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every(([, off]) => off)).toBe(true);
    pages.activate(pages.sides[0] as Side);
    chrome.refresh();
    expect(
      disabled(views)
        .filter(([id]) => id !== 'compare')
        .every(([, off]) => !off),
    ).toBe(true);
  });

  it('leave the window’s alone: the sidebar’s and the list’s chevrons look the same', async () => {
    const { pages, chrome } = await drawn();
    const looks = () =>
      ['pane.sidebar', 'pane.list'].map((id) => {
        const chevron = document.querySelector<HTMLElement>(`[data-command="${id}"]`);
        return [chevron?.getAttribute('aria-pressed'), chevron?.dataset.tip];
      });
    const withStandIn = looks();
    expect(withStandIn[0]).toEqual(['true', 'Hide the sidebar']);
    pages.activate(pages.sides[0] as Side);
    chrome.refresh();
    expect(looks()).toEqual(withStandIn);
  });

  it('look as the first page has them with a companion, whichever page is active', async () => {
    const files = { 'Chapter.md': 'The gate held.' };
    const made = await pagesWith(files, { 'appearance.split': 'companion' }, [standInKind]);
    // The note is the companion, the stand-in the page the layout's tools act on.
    await made.pages.open('Map.stand');
    await made.pages.open('Chapter.md', true);
    expect(made.pages.active.kind).toBe('note');
    const { pages } = made;
    toolsOver(made);
    const seal = pages.pane.slots.bar.querySelector<HTMLButtonElement>('[data-command="seal"]');
    expect(seal?.disabled).toBe(true);
  });

  it('do nothing from the menu while the active page holds another kind', async () => {
    const { pages } = await drawn();
    const outline = { open: false, toggle: vi.fn() };
    const ctx = {
      pages,
      parts: { outline, htmlCopy: { copy: vi.fn() } },
      splits: () => true,
    } as unknown as CommandContext;
    const commands: MenuCommand[] = [
      'find',
      'find:replace',
      'find:next',
      'find:previous',
      'view:next',
      'view:live',
      'view:reading',
      'seal',
      'compare',
      'versions',
      'format:bold',
    ];
    for (const command of commands) expect(() => runCommand(command, ctx)).not.toThrow();
    expect(pages.active.kind).toBe('epub');
    runCommand('split:swap', ctx); // the window's: any page
    expect(pages.sides.map((side) => side.kind)).toEqual(['epub', 'note']);
  });
});
