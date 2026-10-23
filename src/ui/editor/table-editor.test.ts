// The table editor in Live (spec §4, Tables), on the note's editor: the keys
// between cells, a row or column added, removed or moved as one step ⌘Z
// takes back, what's typed kept in its cell, the colophon told, and the
// menus, grips and + with their names and roles. Off a Mac, Mod is Ctrl.

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { FORMAT_COMMANDS } from '../../core/format';
import { closeMenu } from '../menu/menu';
import { NoteEditor } from './editor';
import { NoteDoc } from './note-doc';
import { TableBar } from './table-bar';

const TABLE = '| Name | Age |\n|---|---|\n| Mara | 30 |\n| Levi | 41 |';
const NOTE = `Before.\n\n${TABLE}\n\nAfter.\n`;

let editor: NoteEditor;
let said: Mock<(words: string) => void>;

beforeEach(() => {
  said = vi.fn<(words: string) => void>();
  const host = document.body.appendChild(document.createElement('div'));
  editor = new NoteEditor(host, { changed: () => {}, follow: () => {}, said: (w) => said(w) });
  editor.show(new NoteDoc(NOTE), async () => null);
  // happy-dom fires selectionchange in the middle of an update when the editor has the
  // keyboard, which a browser never does: the keyboard stays out of it here.
  vi.spyOn(editor.view, 'focus').mockImplementation(() => {});
});

afterEach(() => {
  closeMenu();
  editor.view.destroy();
  document.body.replaceChildren();
});

/** The caret after the first `words` in the note (its `nth`), or round them with `select`. */
function caretAt(words: string, select = false): void {
  const from = editor.text.indexOf(words);
  editor.reveal(select ? from : from + words.length, from + words.length);
}

function press(key: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}): void {
  editor.view.contentDOM.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      ctrlKey: mods.ctrl ?? false,
      altKey: mods.alt ?? false,
      shiftKey: mods.shift ?? false,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/** The selection, as the words it covers or the line up to the caret. */
function selected(): string {
  const { from, to } = editor.view.state.selection.main;
  if (from !== to) return editor.text.slice(from, to);
  const line = editor.view.state.doc.lineAt(from);
  return `${editor.text.slice(line.from, from)}‸`;
}

const tableText = () =>
  editor.text.slice(editor.text.indexOf('| Name'), editor.text.indexOf('\n\nAfter'));
const undo = () => press('z', { ctrl: true });
const frame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));

describe('the keys between cells', () => {
  it('Tab goes to the next cell, its words chosen; past the last it adds a row', () => {
    caretAt('Name');
    press('Tab');
    expect(selected()).toBe('Age');
    press('Tab');
    expect(selected()).toBe('Mara');
    caretAt('41');
    press('Tab');
    expect(tableText()).toBe(`${TABLE}\n|  |  |`);
    expect(selected()).toBe('| ‸');
    expect(said).toHaveBeenLastCalledWith('Row added');
  });

  it('Shift-Tab goes back', () => {
    caretAt('Mara');
    press('Tab', { shift: true });
    expect(selected()).toBe('Age');
  });

  it('the arrows cross into the next cell at a cell’s edge, and ↑ ↓ always do', () => {
    caretAt('Mara');
    press('ArrowRight');
    expect(selected()).toBe('| Mara | ‸');
    press('ArrowDown');
    expect(selected()).toBe('| Levi | 41‸');
    press('ArrowUp');
    press('ArrowUp');
    expect(selected()).toBe('| Name | Age‸');
  });

  it('Esc leaves the table, for the line after it', () => {
    caretAt('Mara');
    press('Escape');
    expect(editor.view.state.doc.lineAt(editor.view.state.selection.main.head).text).toBe('');
    expect(editor.inTable).toBe(false);
  });

  it('Shift-Enter says a cell is one line, and adds none', () => {
    caretAt('Mara');
    press('Enter', { shift: true });
    expect(tableText()).toBe(TABLE);
    expect(said).toHaveBeenLastCalledWith('A cell is one line in Markdown');
  });
});

describe('a row or column changed', () => {
  it('Enter adds a row under the caret’s, and ⌘Z takes it back in one step', () => {
    caretAt('Mara');
    press('Enter');
    expect(tableText()).toBe('| Name | Age |\n|---|---|\n| Mara | 30 |\n|  |  |\n| Levi | 41 |');
    undo();
    expect(editor.text).toBe(NOTE);
  });

  it('⌥⌘⌫ removes the row, saying ⌘Z puts it back; and it does', () => {
    caretAt('Mara');
    press('Backspace', { ctrl: true, alt: true });
    expect(tableText()).toBe('| Name | Age |\n|---|---|\n| Levi | 41 |');
    expect(said).toHaveBeenLastCalledWith('Row 1 removed · Ctrl+Z puts it back');
    undo();
    expect(editor.text).toBe(NOTE);
    expect(selected()).toBe('| Mara‸');
  });

  it('⌥⇧⌘⌫ removes the column; the head row and the last column stay', () => {
    caretAt('Age');
    press('Backspace', { ctrl: true, alt: true, shift: true });
    expect(tableText()).toBe('| Name |\n|---|\n| Mara |\n| Levi |');
    expect(said).toHaveBeenLastCalledWith('Column Age removed · Ctrl+Z puts it back');
    press('Backspace', { ctrl: true, alt: true, shift: true });
    expect(said).toHaveBeenLastCalledWith('The last column stays: delete the table in Source');
    press('Backspace', { ctrl: true, alt: true });
    expect(said).toHaveBeenLastCalledWith('The head row stays: a Markdown table always has one');
    expect(tableText()).toBe('| Name |\n|---|\n| Mara |\n| Levi |');
  });

  it('⌥⌘ arrows add a row or column on that side, the caret in it', () => {
    caretAt('Age');
    press('ArrowRight', { ctrl: true, alt: true });
    expect(tableText().split('\n')[0]).toBe('| Name | Age |  |');
    expect(selected()).toBe('| Name | Age | ‸');
    expect(said).toHaveBeenLastCalledWith('Column added: name it');
    caretAt('Levi');
    press('ArrowUp', { ctrl: true, alt: true });
    expect(tableText().split('\n')[3]).toBe('|  |  |  |');
  });

  it('⌥↓ moves the row, as it moves a line elsewhere; never past the head row', () => {
    caretAt('Mara');
    press('ArrowDown', { alt: true });
    expect(tableText()).toBe('| Name | Age |\n|---|---|\n| Levi | 41 |\n| Mara | 30 |');
    expect(selected()).toBe('| Mara‸');
    caretAt('Name');
    press('ArrowDown', { alt: true });
    expect(tableText().split('\n')[0]).toBe('| Name | Age |');
  });
});

describe('what’s typed in a cell', () => {
  const type = (text: string, userEvent = 'input.type') => {
    const { from, to } = editor.view.state.selection.main;
    editor.view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
      userEvent,
    });
  };

  it('saves a pipe as \\|, unless it’s escaped already', () => {
    caretAt('Mara');
    type('|');
    expect(tableText()).toContain('| Mara\\| | 30 |');
    type('\\');
    type('|');
    expect(tableText()).toContain('| Mara\\|\\| | 30 |');
  });

  it('joins pasted lines into one', () => {
    caretAt('Mara');
    type(' one\ntwo', 'input.paste');
    expect(tableText()).toContain('| Mara one two | 30 |');
  });

  it('never loses a cell’s edge to Backspace or Delete', () => {
    caretAt('Age');
    editor.reveal(editor.text.indexOf('Age'), editor.text.indexOf('Age'));
    press('Backspace');
    press('Backspace');
    expect(tableText()).toBe(TABLE.replace('| Age', '|Age'));
  });

  it('is a table’s only in Live: in Source a pipe is a pipe, and Tab is no table key', () => {
    editor.setMode('source');
    caretAt('Mara');
    type('|');
    expect(tableText()).toContain('| Mara| | 30 |');
    press('Tab');
    expect(selected()).toBe('| Mara|‸');
  });
});

describe('the menus', () => {
  const menu = () => document.querySelector<HTMLElement>('.menu[role="menu"]');
  const item = (name: string) =>
    [...(menu()?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? [])].find(
      (button) => button.textContent === name,
    );

  it('Shift-F10 opens the cell’s, its row’s and column’s choices, removing last', () => {
    caretAt('30');
    press('F10', { shift: true });
    expect(menu()?.getAttribute('aria-label')).toBe('Row 1 · Age');
    const names = [...(menu()?.querySelectorAll('[role^="menuitem"]') ?? [])].map(
      (b) => b.textContent,
    );
    expect(names.slice(-2)).toEqual(['Remove row', 'Remove column']);
    expect(item('Align left')?.getAttribute('aria-checked')).toBe('true');
    item('Align right')?.click();
    expect(tableText().split('\n')[1]).toBe('|---|---:|');
    expect(said).toHaveBeenLastCalledWith('Age aligned right');
  });

  it('the formatting bar’s Table opens them in a table, and makes a table elsewhere', () => {
    const table = FORMAT_COMMANDS.find((command) => command.id === 'table');
    if (!table) throw new Error('no Table command');
    caretAt('Mara');
    expect(editor.inTable).toBe(true);
    editor.format(table);
    expect(menu()?.getAttribute('aria-label')).toBe('Row 1 · Name');
    expect(editor.text).toBe(NOTE);
    closeMenu();
    caretAt('After.');
    expect(editor.inTable).toBe(false);
    editor.format(table);
    expect(editor.text.match(/\| --- \| --- \|/g)).toHaveLength(1);
  });
});

describe('the grips and +', () => {
  const tools = () => editor.tableTools;

  it('are buttons named for their row, column or line, for the table the caret is in', async () => {
    caretAt('Mara');
    await frame();
    const names = [...tools().querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(names).toContain('Row 1: menu, or drag to move');
    expect(names).toContain('Column Age: menu, or drag to move');
    expect(names).toContain('Add a column between Name and Age');
    expect(names).toContain('Add a row after row 2');
    expect(tools().querySelector('[data-grip-row="1"]')?.classList.contains('is-on')).toBe(true);
    expect(tools().querySelector('[data-grip-row="2"]')?.classList.contains('is-on')).toBe(false);
    caretAt('After.');
    await frame();
    expect(tools().children).toHaveLength(0);
  });

  it('a grip opens its menu from the keyboard, and says it’s open', async () => {
    caretAt('Mara');
    await frame();
    const grip = tools().querySelector<HTMLElement>('[data-grip-column="1"]');
    grip?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(document.querySelector('.menu')?.getAttribute('aria-label')).toBe('Column · Age');
    expect(grip?.getAttribute('aria-expanded')).toBe('true');
    closeMenu();
    expect(grip?.getAttribute('aria-expanded')).toBe('false');
  });

  it('a + adds the column on its line', async () => {
    caretAt('Mara');
    await frame();
    tools()
      .querySelector<HTMLElement>('[data-add-column="1"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(tableText().split('\n')[0]).toBe('| Name |  | Age |');
    undo();
    expect(editor.text).toBe(NOTE);
  });
});

describe('a phone’s table bar', () => {
  it('is there with the caret in a table, its tools as they are there', () => {
    const bar = new TableBar(editor.view);
    document.body.append(bar.element);
    bar.sync();
    expect(bar.element.hidden).toBe(true);
    caretAt('Name');
    bar.sync();
    expect(bar.element.hidden).toBe(false);
    expect(bar.element.getAttribute('role')).toBe('toolbar');
    const tool = (name: string) =>
      bar.element.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`);
    expect(tool('Remove this row')?.getAttribute('aria-disabled')).toBe('true');
    expect(tool('Align the column left')?.getAttribute('aria-pressed')).toBe('true');
    tool('Add a row below')?.click();
    expect(tableText().split('\n')[2]).toBe('|  |  |');
  });
});
