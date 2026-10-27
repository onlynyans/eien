// The story page (spec §14): a band with the seal and the turns, the story
// on its sheet on the blotter, and the colophon. Keys: ← and → turn the
// chapter, Esc shows the site's own page. Where the page was left is told as
// it's read, and the colophon says how far.

import type { SettingValues } from '../../core/config';
import { placeKey, STORY_SITES, type Story, type Turn } from '../../core/extension';
import { h } from '../dom';
import { type IconName, icon } from '../icons';
import { placeIn, storySheet } from './story-sheet';

export interface StoryActions {
  turn(turn: Turn): void;
  /** Day or night, chosen here: the setting, kept for every story the extension shows. */
  scheme(value: 'day' | 'night'): void;
  /** How far down the page `key` the reader is now, 0 to 1. */
  left(key: string, at: number): void;
}

export interface StoryView {
  /** Show `story`, scrolled to `at` (as it was left), or from its top. */
  show(story: Story, at: number | null): void;
  settings(values: SettingValues): void;
}

/** How long reading must pause before the place is kept: a scroll is many events. */
const KEEP_AFTER_MS = 400;

const words = new Intl.NumberFormat('en');

function iconButton(name: IconName, label: string, onClick: () => void): HTMLButtonElement {
  return h(
    'button',
    {
      class: 'icon-button',
      attrs: { type: 'button', 'aria-label': label, title: label },
      on: { click: onClick },
    },
    icon(name),
  );
}

/** Night, whether chosen or the system's. */
const isNight = (values: SettingValues | null) =>
  values?.['appearance.scheme'] === 'night' ||
  (values?.['appearance.scheme'] !== 'day' && matchMedia('(prefers-color-scheme: dark)').matches);

export function storyView(root: HTMLElement, actions: StoryActions): StoryView {
  let values: SettingValues | null = null;
  let story: Story | null = null;
  let keep: ReturnType<typeof setTimeout> | undefined;

  const previous = iconButton('left', 'Previous chapter (←)', () =>
    actions.turn({ to: 'previous' }),
  );
  const next = iconButton('right', 'Next chapter (→)', () => actions.turn({ to: 'next' }));
  const scheme = iconButton('moon', 'Night', () =>
    actions.scheme(isNight(values) ? 'day' : 'night'),
  );
  const original = iconButton('close', 'Show the site’s page (Esc)', () =>
    actions.turn({ to: 'original' }),
  );
  const site = h('span', { class: 'label' });
  const scroll = h('div', { class: 'page__scroll story__scroll' });
  const said = {
    words: h('span'),
    place: h('span'),
    read: h('span'),
  };
  const dot = () => h('span', { class: 'story__dot', text: '·', attrs: { 'aria-hidden': 'true' } });
  root.replaceChildren(
    h(
      'div',
      { class: 'story' },
      h(
        'header',
        { class: 'story__bar' },
        h(
          'div',
          { class: 'story__mark' },
          h('span', { class: 'seal', text: '永', attrs: { 'aria-hidden': 'true' } }),
          site,
        ),
        h(
          'div',
          { class: 'host', attrs: { role: 'toolbar', 'aria-label': 'Story' } },
          previous,
          next,
          h('span', { class: 'host__rule', attrs: { 'aria-hidden': 'true' } }),
          scheme,
          original,
        ),
      ),
      h('main', { class: 'story__main' }, scroll),
      h(
        'footer',
        { class: 'colophon story__colophon', attrs: { 'aria-label': 'Status' } },
        said.words,
        dot(),
        said.place,
        dot(),
        said.read,
      ),
    ),
  );

  const fraction = () => {
    const room = scroll.scrollHeight - scroll.clientHeight;
    return room > 0 ? scroll.scrollTop / room : 1;
  };
  const showRead = () => {
    said.read.textContent = `${Math.round(fraction() * 100)}% read`;
  };
  scroll.addEventListener(
    'scroll',
    () => {
      showRead();
      clearTimeout(keep);
      const shown = story;
      if (shown) keep = setTimeout(() => actions.left(placeKey(shown), fraction()), KEEP_AFTER_MS);
    },
    { passive: true },
  );

  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'Escape') actions.turn({ to: 'original' });
    else if (event.key === 'ArrowLeft' && story?.previous) actions.turn({ to: 'previous' });
    else if (event.key === 'ArrowRight' && story?.next) actions.turn({ to: 'next' });
    else return;
    event.preventDefault();
  });

  const numerals = () => values?.['books.numerals'] ?? 'roman';
  const draw = (at: number | null) => {
    if (!story) return;
    const shown = story;
    const sheet = storySheet(shown, numerals(), actions.turn);
    scroll.replaceChildren(sheet.element);
    document.title = `${shown.title} · Eien`;
    site.textContent = STORY_SITES[shown.site].name;
    previous.disabled = !shown.previous;
    next.disabled = !shown.next;
    said.words.textContent = `${words.format(sheet.words)} words`;
    said.place.textContent = `Chapter ${placeIn(shown, numerals())}`;
    if (at !== null) scroll.scrollTop = at * (scroll.scrollHeight - scroll.clientHeight);
    showRead();
  };

  return {
    show(shown, at) {
      story = shown;
      draw(at);
      scroll.focus({ preventScroll: true });
    },
    settings(chosen) {
      const redraw = story !== null && values?.['books.numerals'] !== chosen['books.numerals'];
      values = chosen;
      const night = isNight(values);
      scheme.replaceChildren(icon(night ? 'sun' : 'moon'));
      scheme.setAttribute('aria-label', night ? 'Day' : 'Night');
      scheme.title = night ? 'Day' : 'Night';
      if (redraw) draw(fraction());
    },
  };
}
