// A page of another kind and the window's tools (../chrome/commands.ts,
// `on`): a note's commands are set aside where the page they'd act on holds
// something else (#40, the tools by what's in sight), and do nothing from the
// menu; the window's act on any page.
// A stand-in second kind (./stand-in-kind.ts) stands for the EPUB's (backlog #40).

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MenuCommand } from '../../platform/bridge';
import { actsOn, COMMANDS, type CommandId, commandOf, menuOff } from '../chrome/commands';
import { LAYOUT_SPECS } from '../chrome/layouts';
import { type CommandContext, runCommand } from './commands';
import type { Side } from './pages';
import { chromeOver, noted, pagesWith } from './pages-harness';
import { type StandInSide, standInKind } from './stand-in-kind';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  localStorage.clear();
});

const NOTE_COMMANDS = COMMANDS.filter((command) => 'on' in command && command.on === 'note').map(
  ({ id }) => id,
);
/** A book's own (#40, Phase 3b): Pages and Scroll. */
const BOOK_COMMANDS = COMMANDS.filter((command) => 'on' in command && command.on === 'epub').map(
  ({ id }) => id,
);
/** Whether a button's command is one of a note's. */
const ofNote = (id: string | undefined) =>
  (NOTE_COMMANDS as readonly (string | undefined)[]).includes(id);

/** The window's tools drawn over `made`'s pages, taken down after the test. */
function toolsOver(made: Awaited<ReturnType<typeof pagesWith>>) {
  const tools = chromeOver(made);
  stops.push(tools.stop);
  return tools;
}

/** A note on the left, the stand-in beside it (the active one), and the window's tools drawn. */
async function drawn(layout: 'band' | 'slip' | 'runhead' = 'band') {
  const files = { 'Chapter.md': 'The gate held.' };
  const made = await pagesWith(files, { 'appearance.layout': layout, 'editor.formatBar': 'on' }, [
    standInKind,
  ]);
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
    // A book's own, the other way: set aside while a note is the active page.
    expect(BOOK_COMMANDS).toEqual(['view.pages', 'view.scroll', 'bookmark', 'marks']);
    for (const id of BOOK_COMMANDS) expect(actsOn(id, 'note')).toBe(false);
  });

  for (const layout of ['band', 'slip', 'runhead'] as const) {
    it(`are set aside in ${layout}’s bars while the active page holds another kind, and come back with the note`, async () => {
      const { pages, chrome, inSight } = await drawn(layout);
      const bar = inSight();
      const format = inSight('format');
      // The book active: none of the note's tools in sight, the shared ones where they were.
      expect(bar.filter((id) => ofNote(id))).toEqual([]);
      expect(bar).toContain('look');
      expect(format).toEqual([]);
      // The formatting bar's row stays while a note is in sight, so neither page moves.
      expect(pages.pane.slots.format.hidden).toBe(false);
      pages.activate(pages.sides[0] as Side);
      chrome.refresh();
      expect(inSight().filter((id) => ofNote(id)).length).toBeGreaterThan(0);
      expect(inSight('format')).toContain('format.bold');
      expect(inSight()).not.toContain('view.pages');
      expect(inSight()).toEqual(
        expect.arrayContaining(bar.filter((id) => !BOOK_COMMANDS.includes(id as never))),
      );
    });
  }

  for (const layout of ['band', 'slip', 'runhead'] as const) {
    it(`leave a book its own tools in ${layout}’s phone bar, every room but Panes’ (#63)`, async () => {
      const { pages, chrome } = await drawn(layout);
      const phone = () =>
        [
          ...document.querySelectorAll<HTMLButtonElement>(
            `.host--${LAYOUT_SPECS[layout].phone.name} [data-command]`,
          ),
        ]
          .filter((button) => !button.hasAttribute('data-aside'))
          .map((button) => button.dataset.command);
      // The book in front: its views, its bookmark and the look; none of a note's.
      expect(phone()).toEqual(expect.arrayContaining([...BOOK_COMMANDS, 'look']));
      expect(phone().filter((id) => ofNote(id))).toEqual([]);
      pages.activate(pages.sides[0] as Side);
      chrome.refresh();
      expect(phone()).toContain('focus');
      expect(phone().filter((id) => BOOK_COMMANDS.includes(id as never))).toEqual([]);
    });
  }

  it('give a book Marks, which shows its marks, set aside with marks on the edge; Find every page (#64)', async () => {
    const made = await drawn('band');
    const { pages, chrome, inSight, marks, change } = made;
    const marksTool = () =>
      [...document.querySelectorAll<HTMLButtonElement>('[data-command="marks"]')].filter(
        (button) => !button.hasAttribute('data-aside'),
      );
    expect(inSight()).toEqual(expect.arrayContaining(['marks', 'find']));
    marksTool()[0]?.click();
    expect(marks).toHaveBeenCalledOnce();
    change({ 'epub.marks': 'edge' });
    chrome.refresh();
    expect(marksTool()).toEqual([]);
    expect(inSight()).toContain('find');
    // A note in front: Find still, a book's Marks aside.
    change({ 'epub.marks': 'list' });
    pages.activate(pages.sides[0] as Side);
    chrome.refresh();
    expect(inSight()).toContain('find');
    expect(marksTool()).toEqual([]);
  });

  for (const layout of ['band', 'slip', 'runhead'] as const) {
    it(`leave ${layout}’s page tools a note’s with Find, and a book’s with Find and Marks (#64)`, async () => {
      const { pages, chrome } = await drawn(layout);
      const spec = LAYOUT_SPECS[layout];
      /** The layout's page tools in sight, by command, less what a split adds for its pages. */
      const tools = () =>
        [...document.querySelectorAll<HTMLButtonElement>(`.host--${spec.tools} [data-command]`)]
          .filter((button) => !button.hasAttribute('data-aside') && !button.hidden)
          .map((button) => button.dataset.command as CommandId)
          .filter((id) => !('split' in commandOf(id)));
      const strip = layout === 'runhead' ? [] : ['strip'];
      // The book in front: its views, the formatting bar's switch, its bookmark, Marks, Find, Look.
      expect(tools()).toEqual([
        ...(layout === 'band' ? [] : ['view.pages', 'view.scroll']),
        'format-bar',
        'bookmark',
        'marks',
        'find',
        'look',
        ...strip,
      ]);
      pages.activate(pages.sides[0] as Side);
      chrome.refresh();
      // The note in front: its own tools, with Find; no Marks.
      expect(tools()).toEqual([
        ...(layout === 'band' ? [] : ['view.live', 'view.source', 'view.reading']),
        'compare',
        'seal',
        'versions',
        'format-bar',
        'focus',
        'find',
        'look',
        ...strip,
      ]);
    });
  }

  it('give A’s phone bar one view control a page, never a note’s views in a well (#63)', async () => {
    const { pages, chrome } = await drawn('band');
    const host = document.querySelector('.host--phone-band') as HTMLElement;
    const shown = (selector: string) =>
      [...host.querySelectorAll<HTMLElement>(selector)].filter(
        (element) => !element.hidden && !element.hasAttribute('data-aside'),
      );
    const views = () => shown('[data-command^="view."]').map((button) => button.dataset.command);
    // The book in front: Pages and Scroll in their well, a note's one button set aside.
    expect(views()).toEqual(['view.pages', 'view.scroll']);
    expect(shown('.host__group')).toHaveLength(1);
    pages.activate(pages.sides[0] as Side);
    chrome.refresh();
    // The note in front: its one button that steps through its views, and no well drawn empty.
    expect(views()).toEqual(['view.next']);
    expect(shown('.host__group')).toEqual([]);
  });

  it('take the formatting bar’s row with them when a book is the only page', async () => {
    const files = { 'Chapter.md': 'The gate held.' };
    const made = await pagesWith(files, { 'editor.formatBar': 'on' }, [standInKind]);
    await made.pages.open('Chapter.md');
    const { chrome } = toolsOver(made);
    expect(made.pages.pane.slots.format.hidden).toBe(false);
    await made.pages.open('Map.stand');
    chrome.refresh();
    expect(made.pages.active.kind).toBe('epub');
    expect(made.pages.pane.slots.format.hidden).toBe(true);
    expect(document.body.hasAttribute('data-format-bar')).toBe(false);
  });

  it('leave no rule standing alone in a bar where their run was set aside', async () => {
    const { pages, chrome } = await drawn();
    const rules = () =>
      [...pages.pane.slots.bar.querySelectorAll<HTMLElement>('.host__rule')].map((rule) => {
        let [before, after] = [rule.previousElementSibling, rule.nextElementSibling];
        const seen = (el: Element | null) =>
          el instanceof HTMLElement && !el.hidden && !el.hasAttribute('data-aside');
        while (before && !seen(before)) before = before.previousElementSibling;
        while (after && !seen(after)) after = after.nextElementSibling;
        return rule.hidden || (before !== null && after !== null);
      });
    expect(rules().every(Boolean)).toBe(true);
    pages.activate(pages.sides[0] as Side);
    chrome.refresh();
    expect(rules().every(Boolean)).toBe(true);
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
    expect(seal?.hasAttribute('data-aside')).toBe(true);
  });

  it('show the first page’s book’s marks from Marks with a companion, the note beside active (#64)', async () => {
    const files = { 'Chapter.md': 'The gate held.' };
    const made = await pagesWith(files, { 'appearance.split': 'companion' }, [standInKind]);
    await made.pages.open('Map.stand');
    await made.pages.open('Chapter.md', true);
    const { pages } = made;
    const { marks } = toolsOver(made);
    // Marks shows the active page's book's (epub-wiring's showMarks): the book its tool stands
    // for is made the active page first, as a menu command's page is, or the note shows nothing.
    let shownFor: string | undefined;
    marks.mockImplementation(() => {
      shownFor = pages.active.kind;
    });
    const tool = pages.pane.slots.bar.querySelector<HTMLButtonElement>('[data-command="marks"]');
    expect(tool?.hasAttribute('data-aside')).toBe(false);
    tool?.click();
    expect(marks).toHaveBeenCalledOnce();
    expect(shownFor).toBe('epub');
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
    expect(greyMenu.mock.calls).toEqual([[menuOff('epub')], [menuOff('note')]]);
  });

  it('greys nothing in the menu bar once the vault is no longer shown (Open Vault…)', async () => {
    const { chrome, greyMenu } = await drawn();
    chrome.stop();
    expect(greyMenu.mock.calls).toEqual([[menuOff('epub')], [[]]]);
  });

  it('greyed in the menu bar are every note’s control’s, and the menu’s own a note’s page alone has', () => {
    // With a note in front, a book's own are greyed (#40, Phase 3b).
    expect(menuOff('note')).toEqual([
      'view:pages',
      'view:scroll',
      'bookmark',
      // Walking a book's marks (Phase 5b): the menu's own, no control of their own.
      'mark:next',
      'mark:previous',
    ]);
    const off = menuOff('epub');
    const sends = COMMANDS.flatMap((command) =>
      'on' in command && command.on === 'note' && 'sends' in command ? [command.sends] : [],
    );
    // Every note's control greyed, but the format a book's words take too (#40, Phase 5a).
    expect(off).toEqual(
      expect.arrayContaining(sends.filter((command) => command !== 'format:highlight')),
    );
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
      // Format → Highlight: a book's words take it too (#40, Phase 5a).
      'format:highlight',
      // A book's own walk, never greyed with the book in front (QA, Phase 5b).
      'mark:next',
      'mark:previous',
      'bookmark',
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
