// A story on Eien's sheet (spec §14): the running head (its fandom, its title,
// the chapter), the title and who wrote it, what the site says of it, folded
// away; then each chapter, its notes beside its words, and the turn to the
// next. Everything the site wrote is drawn from cleaned nodes (./draw-clean.ts).

import { cleanHtml, plainOf, type Story, type StoryChapter, type Turn } from '../../core/extension';
import { chapterNumber, countPlainWords, type NumeralStyle } from '../../core/text';
import { h, wordButton } from '../dom';
import { drawClean } from './draw-clean';

export interface Sheet {
  readonly element: HTMLElement;
  /** The words of the chapters shown, as Eien counts a note's. */
  readonly words: number;
}

/** A note of the site's (a summary, the author's notes): its name, then its words, quieter than the story's. */
function aside(name: string, html: string, className = ''): HTMLElement | null {
  const nodes = cleanHtml(html);
  if (!plainOf(nodes).trim()) return null;
  return h(
    'aside',
    { class: `story__aside ${className}`.trim(), attrs: { 'aria-label': name } },
    h('p', { class: 'label', text: name }),
    h('div', { class: 'prose prose--aside' }, drawClean(nodes)),
  );
}

/** What the site says of the work (rating, tags, words), folded: it's there when wanted. */
function facts(story: Story): HTMLElement | null {
  if (story.facts.length === 0) return null;
  return h(
    'details',
    { class: 'story__facts' },
    h('summary', { class: 'label', text: 'About this work' }),
    h(
      'dl',
      {},
      ...story.facts.flatMap((fact) => [
        h('dt', { class: 'label', text: fact.label }),
        h('dd', { text: fact.values.join(' · ') }),
      ]),
    ),
  );
}

function chapter(
  story: Story,
  shown: StoryChapter,
  numerals: NumeralStyle,
): { element: HTMLElement; words: number } {
  const nodes = cleanHtml(shown.body);
  const titled = shown.title !== '' || story.chapters.length > 1 || story.chapterCount !== 1;
  const heading = titled
    ? h(
        'header',
        { class: 'story__chapter-head' },
        h('p', { class: 'label', text: `Chapter ${chapterNumber(shown.number, numerals)}` }),
        shown.title ? h('h2', { class: 'story__chapter-title', text: shown.title }) : null,
      )
    : null;
  return {
    element: h(
      'section',
      {
        class: 'story__chapter',
        attrs: { 'aria-label': shown.title || `Chapter ${shown.number}` },
      },
      heading,
      aside('Summary', shown.summary),
      aside('Notes', shown.notes),
      h('div', { class: 'prose' }, drawClean(nodes)),
      aside('Notes', shown.endNotes, 'story__aside--end'),
    ),
    words: countPlainWords(plainOf(nodes)),
  };
}

/** The chapters shown, by their numbers: "ii", or "i–xii" for the whole work at once. */
function chaptersShown(story: Story, numerals: NumeralStyle): string {
  const first = story.chapters[0]?.number ?? 1;
  const last = story.chapters[story.chapters.length - 1]?.number ?? first;
  return first === last
    ? chapterNumber(first, numerals)
    : `${chapterNumber(first, numerals)}–${chapterNumber(last, numerals)}`;
}

/** The chapters' place in the work, as the colophon says it. */
export const placeIn = (story: Story, numerals: NumeralStyle): string =>
  `${chaptersShown(story, numerals)} of ${story.chapterCount ?? '?'}`;

export function storySheet(story: Story, numerals: NumeralStyle, turn: (to: Turn) => void): Sheet {
  const crumbs = [story.fandoms[0], story.title, chaptersShown(story, numerals)];
  const chapters = story.chapters.map((shown) => chapter(story, shown, numerals));
  const turns = [
    story.previous ? wordButton('Previous chapter', () => turn({ to: 'previous' })) : null,
    story.next ? wordButton('Next chapter', () => turn({ to: 'next' })) : null,
  ].filter((button): button is HTMLButtonElement => button !== null);
  const element = h(
    'article',
    { class: 'sheet story__sheet' },
    h(
      'div',
      { class: 'sheet__head' },
      h('p', { class: 'crumbs label', text: crumbs.filter(Boolean).join(' / ') }),
    ),
    h('h1', { class: 'title', text: story.title || 'Untitled' }),
    story.authors.length > 0
      ? h('p', { class: 'story__byline', text: `by ${story.authors.join(', ')}` })
      : null,
    facts(story),
    aside('Summary', story.summary),
    aside('Notes', story.notes),
    ...chapters.map((each) => each.element),
    aside('Notes', story.endNotes, 'story__aside--end'),
    turns.length > 0
      ? h('nav', { class: 'story__turns', attrs: { 'aria-label': 'Chapters' } }, ...turns)
      : null,
  );
  return { element, words: chapters.reduce((sum, each) => sum + each.words, 0) };
}
