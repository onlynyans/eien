// A book's colophon (#40, Phase 5a): its line of news offers Put back (a
// word button, apart from the news the ear hears) only while that news
// shows: another line of news without one takes it away, a click runs it
// once, and the keyboard on it goes back to the page as it goes; and
// "highlighted" is said of the page in sight, and nothing once cleared.

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { BookFoot } from './book-foot';

let home: Mock<() => void>;
let foot: BookFoot;

beforeEach(() => {
  vi.useFakeTimers();
  home = vi.fn<() => void>();
  foot = new BookFoot(() => {}, home);
  // The colophon the pane would lay the figures and the news in.
  document.body.append(foot.said, ...foot.figures);
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

const putBack = () =>
  foot.figures.find(
    (figure): figure is HTMLButtonElement =>
      figure instanceof HTMLButtonElement && figure.textContent === 'Put back',
  );
const offered = () => {
  const button = putBack();
  return button !== undefined && !button.hidden;
};

describe('a book’s colophon’s Put back', () => {
  it('shows with the news it undoes, and goes with the next news that offers none', () => {
    const run = vi.fn();
    foot.say('Highlight taken off.', { label: 'Put back', run });
    expect(offered()).toBe(true);
    foot.say('Highlighted.');
    expect(foot.said.textContent).toBe('Highlighted.');
    expect(offered()).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('is never in the news the ear hears: the status says the words alone', () => {
    foot.say('Highlight taken off.', { label: 'Put back', run: () => {} });
    expect(foot.said.getAttribute('role')).toBe('status');
    expect(foot.said.textContent).toBe('Highlight taken off.');
    expect(foot.said.querySelector('button')).toBeNull();
    const button = putBack();
    expect(button && foot.said.contains(button)).toBe(false);
    expect(button?.getAttribute('type')).toBe('button');
  });

  it('runs once when clicked, and is gone at once, so a second click does nothing', () => {
    const run = vi.fn();
    foot.say('Highlight taken off.', { label: 'Put back', run });
    const button = putBack();
    button?.click();
    button?.click();
    expect(run).toHaveBeenCalledOnce();
    expect(offered()).toBe(false);
  });

  it('goes with its news after a while, the keyboard on it sent back to the page', () => {
    foot.say('Highlight taken off.', { label: 'Put back', run: () => {} });
    putBack()?.focus();
    vi.advanceTimersByTime(7999);
    expect(offered()).toBe(true);
    expect(home).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(foot.said.textContent).toBe('');
    expect(offered()).toBe(false);
    expect(home).toHaveBeenCalledOnce();
  });

  it('replaced by other news with the keyboard on it, sends the keyboard back to the page', () => {
    foot.say('Highlight taken off.', { label: 'Put back', run: () => {} });
    putBack()?.focus();
    foot.say('Highlighted.');
    expect(home).toHaveBeenCalledOnce();
  });

  it('leaves the keyboard where it is when it goes from under no one', () => {
    foot.say('Highlight taken off.', { label: 'Put back', run: () => {} });
    foot.say('Highlighted.');
    vi.advanceTimersByTime(8000);
    expect(home).not.toHaveBeenCalled();
  });

  it('a later offer is the one that runs, its own words on the button', () => {
    const first = vi.fn();
    const second = vi.fn();
    foot.say('Highlight taken off.', { label: 'Put back', run: first });
    foot.say('Bookmark taken off.', { label: 'Undo', run: second });
    const button = foot.figures.at(-1) as HTMLButtonElement;
    expect(button.textContent).toBe('Undo');
    button.click();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});

describe('“highlighted” in a book’s colophon', () => {
  const heard = () => foot.figures.some((figure) => figure.textContent === 'highlighted');

  it('is said of the page in sight while it holds one, and nothing once cleared', () => {
    foot.highlighted(true);
    expect(heard()).toBe(true);
    foot.highlighted(false);
    expect(heard()).toBe(false);
    foot.highlighted(true);
    foot.clear();
    expect(heard()).toBe(false);
  });
});
