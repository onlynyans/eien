import { describe, expect, it, vi } from 'vitest';
import { renderContents } from './contents-list';

const MODEL = {
  title: 'Pride and Prejudice',
  author: 'Jane Austen',
  rows: [
    { title: 'Volume I', depth: 0, spine: 1 },
    { title: 'Chapter I', depth: 1, spine: 1 },
    { title: 'Chapter II', depth: 1, spine: 2 },
  ],
  spine: 1,
};

function drawn(model = MODEL) {
  const container = document.body.appendChild(document.createElement('section'));
  const choose = vi.fn();
  renderContents(container, model, null, choose);
  return { container, choose };
}

const rows = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLButtonElement>('.contents-row'),
];

describe('a book’s contents in the list', () => {
  it('heads the list with the book, its author and how many chapters', () => {
    const { container } = drawn();
    expect(container.querySelector('.list__heading')?.textContent).toBe('Pride and Prejudice');
    expect(container.querySelector('.list__count')?.textContent).toBe('Jane Austen · 3 chapters');
    expect(container.querySelector('ul')?.getAttribute('aria-label')).toBe(
      'Contents of Pride and Prejudice',
    );
  });

  it('marks once the chapter on the page, though two rows start in its file', () => {
    const { container } = drawn();
    expect(rows(container).map((row) => row.getAttribute('aria-current'))).toEqual([
      'true',
      null,
      null,
    ]);
  });

  it('opens a row’s chapter by click, and moves between rows by arrow keys', () => {
    const { container, choose } = drawn();
    const [, one, two] = rows(container);
    two?.click();
    expect(choose).toHaveBeenCalledWith(2);
    one?.focus();
    one?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(two);
    two?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(rows(container)[0]);
  });

  it('keeps the keyboard on its row through a redraw', () => {
    const { container, choose } = drawn();
    rows(container)[2]?.focus();
    renderContents(container, { ...MODEL, spine: 2 }, null, choose);
    expect(document.activeElement).toBe(rows(container)[2]);
    expect(rows(container)[2]?.getAttribute('aria-current')).toBe('true');
  });

  it('says “1 chapter”, and leaves out an author the book doesn’t name', () => {
    const { container } = drawn({
      ...MODEL,
      author: '',
      rows: [{ title: 'Only', depth: 0, spine: 0 }],
    });
    expect(container.querySelector('.list__count')?.textContent).toBe('1 chapter');
  });
});
