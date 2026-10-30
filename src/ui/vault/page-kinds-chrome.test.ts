// A page of another kind and the window's tools (../chrome/commands.ts,
// `on`): a note's commands look disabled where the page they'd act on holds
// something else, and do nothing from the menu; the window's act on any page.
// A stand-in second kind (./stand-in-kind.ts) stands for the EPUB's (backlog #40).

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MenuCommand } from '../../platform/bridge';
import { actsOn, COMMANDS, type CommandId, menuOff } from '../chrome/commands';
import type { MenuBus } from '../menu/menu-bus';
import type { PaneLayout } from '../shell/panes';
import type { Sidebar } from '../sidebar/sidebar';
import { vaultChrome } from './chrome-wiring';
import { type CommandContext, runCommand } from './commands';
import type { Side } from './pages';
import { noted, pagesWith } from './pages-harness';
import type { PhoneView } from './phone-view';
import { type StandInSide, standInKind } from './stand-in-kind';

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
  const greyMenu = vi.fn<(commands: readonly MenuCommand[]) => void>();
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
    platform: 'linux',
    greyMenu,
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
  return { chrome, disabled, greyMenu };
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

  it('grey in the menu bar while a page of another kind is in front, and come back with a note', async () => {
    const { pages, chrome, greyMenu } = await drawn();
    expect(greyMenu.mock.calls).toEqual([[menuOff('epub')]]);
    pages.activate(pages.sides[0] as Side);
    chrome.refresh();
    chrome.refresh(); // told once for each change of kind
    expect(greyMenu.mock.calls).toEqual([[menuOff('epub')], [[]]]);
  });

  it('greys nothing in the menu bar once the vault is no longer shown (Open Vault…)', async () => {
    const { chrome, greyMenu } = await drawn();
    chrome.stop();
    expect(greyMenu.mock.calls).toEqual([[menuOff('epub')], [[]]]);
  });

  it('greyed in the menu bar are every note’s control’s, and the menu’s own a note’s page alone has', () => {
    expect(menuOff('note')).toEqual([]);
    const off = menuOff('epub');
    const sends = COMMANDS.flatMap((command) =>
      'on' in command && 'sends' in command ? [command.sends] : [],
    );
    expect(off).toEqual(expect.arrayContaining(sends));
    expect(off).toEqual(
      expect.arrayContaining([
        'view:next',
        'toggle:editor.focus',
        'copy-html',
        'format:heading2',
        'format:table',
        'export-html',
        'export-note:epub',
        'export-note:docx',
        'export-note:pdf',
        'outline',
        'toggle:editor.typewriter',
        'toggle:editor.marks',
      ]),
    );
    // A page's, the window's, and settings that are the window's stay on.
    for (const on of [
      'find',
      'find:next',
      'look',
      'export-book:epub',
      'split',
      'new-note',
      'toggle:editor.formatBar',
      'toggle:editor.spellcheck',
    ] as const)
      expect(off).not.toContain(on);
    expect(new Set(off).size).toBe(off.length);
  });

  it('find from the menu on the active page, whatever it holds', async () => {
    const { pages } = await drawn();
    const ctx = { pages } as unknown as CommandContext;
    for (const command of ['find', 'find:replace', 'find:next', 'find:previous'] as const)
      runCommand(command, ctx);
    expect((pages.active as StandInSide).finds).toEqual(['open', 'replace', 'next', 'previous']);
    // The note beside is never searched for it.
    expect(document.querySelector<HTMLElement>('.find')?.hidden).toBe(true);
  });

  it('find on a note’s page only where its text is on the page', async () => {
    const { pages } = await drawn();
    const note = noted(pages.sides[0]);
    pages.activate(note);
    const bar = note.page.element.querySelector<HTMLElement>('.find');
    const ctx = { pages } as unknown as CommandContext;
    note.page.compare(document.createElement('div')); // a seal in the editor's place
    // Next and Previous with nothing typed would open the bar, where they may.
    for (const command of ['find', 'find:replace', 'find:next', 'find:previous'] as const)
      runCommand(command, ctx);
    expect(bar?.hidden).toBe(true);
    note.page.compare(null);
    runCommand('find', ctx);
    expect(bar?.hidden).toBe(false);
  });
});
