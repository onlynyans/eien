// AO3, the Archive of Our Own (archiveofourown.org): a work's page, one
// chapter or the whole work (otwarchive's work and chapter views).

import type { StoryChapter, StoryFact } from '../../../core/reader';
import { htmlOf, onSite, wordsOf, wordsOfAll } from './page-text';
import type { Site } from './site';

/** The tags and words the work's header lists, in its order: the label is the site's own. */
const FACTS = [
  'rating',
  'warning',
  'category',
  'relationship',
  'character',
  'freeform',
  'language',
];

function factsOf(page: Document): StoryFact[] {
  const meta = page.querySelector('dl.work.meta');
  if (!meta) return [];
  const facts = FACTS.flatMap((kind) => {
    const value = meta.querySelector(`dd.${kind}`);
    if (!value) return [];
    const label = wordsOf(meta.querySelector(`dt.${kind}`)).replace(/:$/u, '');
    const tags = wordsOfAll(value.querySelectorAll('a.tag'));
    const values = tags.length > 0 ? tags : [wordsOf(value)];
    return label && values[0] ? [{ label, values }] : [];
  });
  const words = wordsOf(meta.querySelector('dl.stats dd.words'));
  return words ? [...facts, { label: 'Words', values: [words] }] : facts;
}

/** A chapter's own title, without the "Chapter 4" every chapter has. */
const ownTitle = (heading: string) => heading.replace(/^Chapter\s+\d+\s*:?\s*/iu, '').trim();

function chaptersOf(work: Element, at: URL): StoryChapter[] {
  const chapters = [...work.querySelectorAll('#chapters > .chapter')];
  if (chapters.length === 0) {
    const body = work.querySelector('#chapters > .userstuff');
    if (!body) return [];
    return [{ number: 1, title: '', summary: '', notes: '', body: htmlOf(body, at), endNotes: '' }];
  }
  return chapters.flatMap((chapter, i) => {
    const body = chapter.querySelector(':scope > .userstuff');
    if (!body) return [];
    const number = Number(/^chapter-(\d+)$/u.exec(chapter.id)?.[1] ?? i + 1);
    const part = (selector: string) =>
      htmlOf(chapter.querySelector(`:scope > .preface ${selector} .userstuff`), at);
    return [
      {
        number,
        title: ownTitle(wordsOf(chapter.querySelector(':scope > .preface .title'))),
        summary: part('.summary'),
        notes: part('.notes:not(.end)'),
        body: htmlOf(body, at),
        endNotes: part('.end.notes'),
      },
    ];
  });
}

/** "2/12" is twelve chapters; "2/?" is a work whose end isn't known yet. */
function chapterCountOf(page: Document, shown: number): number | null {
  const said = wordsOf(page.querySelector('dl.work.meta dl.stats dd.chapters'));
  const total = /\/\s*(\d+|\?)/u.exec(said)?.[1];
  if (total === '?') return null;
  return total ? Number(total) : shown;
}

export const AO3: Site = {
  id: 'ao3',
  holds: (at) => at.hostname === 'archiveofourown.org',
  read(page, at) {
    const workId = /^\/works\/(\d+)/u.exec(at.pathname)?.[1];
    const work = page.querySelector('#workskin');
    if (!workId || !work) return null;
    const chapters = chaptersOf(work, at);
    if (chapters.length === 0) return null;
    const preface = work.querySelector(':scope > .preface');
    const byline = preface?.querySelector('.byline');
    const authors = wordsOfAll(byline?.querySelectorAll('a[rel="author"]') ?? []);
    const navigation = page.querySelector('ul.work.navigation');
    const link = (which: string) =>
      navigation?.querySelector(`li.chapter.${which} a`)?.getAttribute('href') ?? null;
    const index = [...page.querySelectorAll<HTMLOptionElement>('#selected_id option')];
    return {
      story: {
        site: 'ao3',
        id: `ao3:${workId}`,
        title: wordsOf(preface?.querySelector('.title')),
        authors: authors.length > 0 ? authors : wordsOfAll(byline ? [byline] : []),
        fandoms: wordsOfAll(page.querySelectorAll('dl.work.meta dd.fandom a.tag')),
        summary: htmlOf(preface?.querySelector(':scope > .summary .userstuff'), at),
        notes: htmlOf(preface?.querySelector(':scope > .notes .userstuff'), at),
        endNotes: htmlOf(work.querySelector('#work_endnotes .userstuff'), at),
        facts: factsOf(page),
        chapters,
        chapterCount: chapterCountOf(page, chapters.length),
        previous: link('previous') !== null,
        next: link('next') !== null,
      },
      turnTo(turn) {
        if (turn.to === 'chapter') {
          const id = index[turn.number - 1]?.value;
          return id ? onSite(`/works/${workId}/chapters/${encodeURIComponent(id)}`, at) : null;
        }
        const href = link(turn.to);
        return href ? onSite(href, at) : null;
      },
    };
  },
};
