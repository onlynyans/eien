// FanFiction.Net (www.fanfiction.net, and its phone site m.fanfiction.net):
// a story's chapter, at /s/<story>/<chapter>/<title>.

import type { StoryFact } from '../../../core/reader';
import { htmlOf, onSite, wordsOf, wordsOfAll } from './page-text';
import type { Site } from './site';

/** What the story's line of details says that a reader wants; the counts of reviews and follows aren't. */
const KEPT_FACTS = new Set(['Rated', 'Words', 'Status', 'Updated', 'Published']);

/**
 * The line under the summary: "Rated: Fiction T - English - Drama/Romance -
 * Hermione G. - Chapters: 3 - Words: 12,345 - …". Labelled parts are facts;
 * the rest (language, genres, characters) are what the story is about.
 */
function factsOf(line: string): StoryFact[] {
  const parts = line
    .split(/\s+-\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const about: string[] = [];
  const facts: StoryFact[] = [];
  for (const part of parts) {
    const [, label, value] = /^([A-Za-z]+):\s*(.*)$/u.exec(part) ?? [];
    if (label === undefined || value === undefined) about.push(part);
    else if (KEPT_FACTS.has(label)) {
      facts.push({ label, values: [value.replace(/^Fiction\s+/u, '')] });
    }
  }
  return about.length > 0 ? [{ label: 'About', values: about }, ...facts] : facts;
}

/** The story's title from the tab's: "Beneath the Walls Chapter 2: The Gate, a … fanfic | FanFiction". */
const titleOfTab = (title: string) =>
  title
    .replace(/\s*\|\s*FanFiction\s*$/iu, '')
    .replace(/(?:\s+Chapter\s+\d+.*)?,\s+an?\s.*$/iu, '');

export const FFN: Site = {
  id: 'ffn',
  holds: (at) => at.hostname === 'www.fanfiction.net' || at.hostname === 'm.fanfiction.net',
  read(page, at) {
    const [, storyId, shown, slug = ''] =
      /^\/s\/(\d+)(?:\/(\d+))?(?:\/([^/]*))?/u.exec(at.pathname) ?? [];
    const body = page.querySelector('#storytext, #storycontent');
    if (!storyId || !body) return null;
    const top = page.querySelector('#profile_top');
    const centred = page.querySelector('#content > div[align="center"]');
    const options = [...page.querySelectorAll<HTMLOptionElement>('#chap_select option')]
      // The page lists its chapters twice, above the story and below.
      .filter((option, i, all) => all.findIndex((o) => o.value === option.value) === i);
    const number = Number(shown ?? 1);
    const optionTitle = wordsOf(options[number - 1]).replace(/^\d+\.\s*/u, '');
    const phoneTitle = /^Chapter\s+\d+:\s*(.*)$/iu.exec(wordsOf(centred?.nextElementSibling))?.[1];
    const linkTo = (words: RegExp) =>
      [...page.querySelectorAll<HTMLAnchorElement>(`a[href^="/s/${storyId}/"]`)].find((a) =>
        words.test(wordsOf(a)),
      );
    // No chapter list: a one-shot, or the phone site, which only links the chapters beside.
    const count = options.length > 0 ? options.length : linkTo(/Next|Prev/u) ? null : 1;
    const fandomLinks = page.querySelectorAll('#pre_story_links a');
    const author = top?.querySelector('a[href^="/u/"]') ?? centred?.querySelector('a[href^="/u/"]');
    return {
      story: {
        site: 'ffn',
        id: `ffn:${storyId}`,
        title:
          wordsOf(top?.querySelector('b')) ||
          wordsOf(centred?.querySelector('b')) ||
          titleOfTab(page.title),
        authors: wordsOfAll(author ? [author] : []),
        fandoms: wordsOfAll(
          fandomLinks.length > 0 ? [fandomLinks[fandomLinks.length - 1] as Element] : [],
        ),
        summary: htmlOf(
          [...(top?.children ?? [])].find(
            (child) => child.matches('div.xcontrast_txt') && wordsOf(child),
          ),
          at,
        ),
        notes: '',
        endNotes: '',
        facts: factsOf(wordsOf(top?.querySelector('span.xgray'))),
        chapters: [
          {
            number,
            title: optionTitle || phoneTitle || '',
            summary: '',
            notes: '',
            body: htmlOf(body, at),
            endNotes: '',
          },
        ],
        chapterCount: count,
        previous: count !== null ? number > 1 : linkTo(/Prev/u) !== undefined,
        next: count !== null ? number < count : linkTo(/Next/u) !== undefined,
      },
      turnTo(turn) {
        const to =
          turn.to === 'chapter' ? turn.number : turn.to === 'next' ? number + 1 : number - 1;
        if (to < 1 || (count !== null && to > count)) return null;
        if (count === null && turn.to === 'chapter') return null;
        return onSite(`/s/${storyId}/${to}/${slug}`, at);
      },
    };
  },
};
