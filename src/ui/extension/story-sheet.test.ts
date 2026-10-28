import { describe, expect, it, vi } from 'vitest';
import type { Story, StoryChapter } from '../../core/extension';
import { placeIn, storySheet } from './story-sheet';

const chapter = (number: number, more: Partial<StoryChapter> = {}): StoryChapter => ({
  number,
  title: '',
  summary: '',
  notes: '',
  body: '<p>One two three.</p>',
  endNotes: '',
  ...more,
});

const story = (more: Partial<Story> = {}): Story => ({
  site: 'ao3',
  id: 'ao3:1',
  title: 'Beneath the Walls',
  authors: ['Rook', 'Wren'],
  fandoms: ['Harry Potter'],
  summary: '',
  notes: '',
  endNotes: '',
  facts: [],
  chapters: [chapter(4, { title: 'The Gate' })],
  chapterCount: 12,
  previous: true,
  next: true,
  ...more,
});

describe('storySheet', () => {
  it('heads the sheet with the fandom, the title and the chapter, then the title and who wrote it', () => {
    const { element } = storySheet(story(), 'roman', () => {});
    expect(element.querySelector('.crumbs')?.textContent).toBe(
      'Harry Potter / Beneath the Walls / iv',
    );
    expect(element.querySelector('h1')?.textContent).toBe('Beneath the Walls');
    expect(element.querySelector('.story__byline')?.textContent).toBe('by Rook, Wren');
    expect(element.querySelector('.story__chapter-head')?.textContent).toBe('Chapter ivThe Gate');
  });

  it('counts the chapters’ words', () => {
    expect(storySheet(story(), 'roman', () => {}).words).toBe(3);
  });

  it('shows a note only where it has words', () => {
    const { element } = storySheet(
      story({ summary: '<p> </p>', notes: '<p>For S.</p>' }),
      'roman',
      () => {},
    );
    expect(
      [...element.querySelectorAll('.story__aside')].map((a) => a.getAttribute('aria-label')),
    ).toEqual(['Notes']);
  });

  it('leaves a work of one untitled chapter without a chapter heading', () => {
    const { element } = storySheet(
      story({ chapters: [chapter(1)], chapterCount: 1, previous: false, next: false }),
      'roman',
      () => {},
    );
    expect(element.querySelector('.story__chapter-head')).toBeNull();
    expect(element.querySelector('.story__turns')).toBeNull();
  });

  it('turns from its foot', () => {
    const turn = vi.fn();
    const { element } = storySheet(story({ previous: false }), 'arabic', turn);
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('.story__turns button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Next chapter']);
    buttons[0]?.click();
    expect(turn).toHaveBeenCalledWith({ to: 'next' });
  });

  it('says what the site says of the work, folded', () => {
    const { element } = storySheet(
      story({ facts: [{ label: 'Rating', values: ['Teen', 'Mature'] }] }),
      'roman',
      () => {},
    );
    const facts = element.querySelector('details.story__facts');
    expect(facts?.hasAttribute('open')).toBe(false);
    expect(facts?.querySelector('dd')?.textContent).toBe('Teen · Mature');
  });
});

/** What the story page drew for RICH before the cleaner was shared (#40, Phase 0): the same now. */
const GOLDEN = [
  '<p>She <em>ran</em>, <strong>fast</strong>.</p>',
  '<p data-align="center">*</p><div class="scene-break" role="separator">***</div><div data-align="center">end</div>',
  '<p data-align="right">To <a title="The work" href="https://ao3.org/works/1" target="_blank" rel="noopener noreferrer">the work</a>,',
  ' <a href="mailto:a@b.c" target="_blank" rel="noopener noreferrer">mail</a>, <a>here</a>, <a>there</a>.</p>',
  '<img title="Map" alt="A map" loading="lazy" src="https://i.example/a.png">',
  '<p>[&lt;b&gt;plan&lt;/b&gt;]</p>',
  '<table><tr><td data-align="right">1</td><td><abbr title="Sir">S.</abbr></td></tr></table>',
  '<p>&lt;script&gt;words&lt;/script&gt;</p>',
].join('');
const WORDS = 17;
/** A chapter with every kind of thing the cleaner keeps, drops or turns to words. */
const RICH = [
  '<h3 class="landmark heading">Chapter Text</h3>',
  '<p id="a" class="b" style="color:red" onclick="x()">She <em>ran</em>, <span style="font-weight:700">fast</span>.</p>',
  '<p align="center">*</p><hr><center>end</center>',
  '<p style="text-align: right">To <a href="https://ao3.org/works/1" target="_top" title="The work">the work</a>,',
  ' <a href="mailto:a@b.c">mail</a>, <a href="/works/2">here</a>, <a href="java\tscript:x()">there</a>.</p>',
  '<img src="https://i.example/a.png" alt="A map" title="Map" width="900" onerror="x()">',
  '<p><img src="http://i.example/b.png" alt="&lt;b&gt;plan&lt;/b&gt;"><img src="data:x"></p>',
  '<table><tr><td align="right">1</td><td><abbr title="Sir">S.</abbr></td></tr></table>',
  '<script>alert(1)</script><iframe src="https://e.x"></iframe><form><input value="v"></form>',
  '<p>&lt;script&gt;words&lt;/script&gt;</p>',
].join('');

describe('storySheet: a chapter drawn as the story page has always drawn it', () => {
  it('draws the same DOM and counts the same words', () => {
    const sheet = storySheet(story({ chapters: [chapter(1, { body: RICH })] }), 'roman', () => {});
    expect(sheet.element.querySelector('.story__chapter > .prose')?.innerHTML).toBe(GOLDEN);
    expect(sheet.words).toBe(WORDS);
  });
});

describe('storySheet: the site’s links', () => {
  it('opens each in a tab of its own, telling the site nothing', () => {
    const body = '<p><a href="https://example.org/">x</a> <a href="/works/2">y</a></p>';
    const { element } = storySheet(story({ chapters: [chapter(1, { body })] }), 'roman', () => {});
    const [web, relative] = [...element.querySelectorAll('.prose a')];
    expect(web?.getAttribute('href')).toBe('https://example.org/');
    expect((web as HTMLAnchorElement).target).toBe('_blank');
    expect((web as HTMLAnchorElement).rel).toBe('noopener noreferrer');
    expect(relative?.hasAttribute('target')).toBe(false);
  });
});

describe('placeIn', () => {
  it('names the chapters shown, of how many', () => {
    expect(placeIn(story(), 'roman')).toBe('iv of 12');
    expect(
      placeIn(story({ chapters: [chapter(1), chapter(2)], chapterCount: null }), 'arabic'),
    ).toBe('1–2 of ?');
  });
});
