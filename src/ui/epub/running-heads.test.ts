import { describe, expect, it } from 'vitest';
import type { Epub } from '../../core/epub';
import { RunningHeads } from './running-heads';
import type { PageShown } from './sight';

const EPUB = {
  title: 'Pride and Prejudice',
  contents: [{ title: 'Chapter III', spine: 4, depth: 0 }],
} as unknown as Epub;

/** The heads' and folios' words, verso then recto, after showing `sight`, each page numbered by its offset / 1,000. */
function shown(sight: readonly PageShown[]) {
  const heads = new RunningHeads();
  heads.show(sight, EPUB, 4, ({ from }) => String(Math.floor(from / 1000) + 1));
  const words = (row: HTMLElement) => [...row.children].map((slot) => slot.textContent);
  return { heads: words(heads.head), folios: words(heads.folio) };
}

describe('running heads and folios (Phase 3d)', () => {
  it('one page: the chapter at its head, its number at its outer corner', () => {
    expect(shown([{ role: 'text', from: 2500 }])).toEqual({
      heads: ['Chapter III', ''],
      folios: ['', '3'],
    });
  });

  it('a spread: the book over the verso, the chapter over the recto, each folio outermost', () => {
    expect(
      shown([
        { role: 'text', from: 2500 },
        { role: 'text', from: 3500 },
      ]),
    ).toEqual({ heads: ['Pride and Prejudice', 'Chapter III'], folios: ['3', '4'] });
  });

  it('leaves an opening page’s head off, keeping its folio', () => {
    expect(
      shown([
        { role: 'opening', from: 0 },
        { role: 'text', from: 1200 },
      ]),
    ).toEqual({ heads: ['', 'Chapter III'], folios: ['1', '2'] });
    expect(shown([{ role: 'opening', from: 0 }])).toEqual({ heads: ['', ''], folios: ['', '1'] });
  });

  it('gives the front matter and an empty recto neither', () => {
    expect(
      shown([
        { role: 'front', from: 0 },
        { role: 'front', from: 0 },
      ]),
    ).toEqual({ heads: ['', ''], folios: ['', ''] });
    expect(
      shown([
        { role: 'text', from: 2500 },
        { role: 'blank', from: Number.POSITIVE_INFINITY },
      ]),
    ).toEqual({ heads: ['Pride and Prejudice', ''], folios: ['3', ''] });
  });

  it('numbers a recto that begins on the verso’s page once, on the verso', () => {
    expect(
      shown([
        { role: 'text', from: 2100 },
        { role: 'text', from: 2900 },
      ]).folios,
    ).toEqual(['3', '']);
  });

  it('is nothing with no page in sight, or no page number known', () => {
    const heads = new RunningHeads();
    heads.show([{ role: 'text', from: 0 }], EPUB, 4, () => null);
    expect(heads.folio.textContent).toBe('');
    heads.show([], EPUB, 4, () => '1');
    expect(heads.head.textContent).toBe('');
  });
});

// QA (#40, Phase 3d): the heads and folios keep their slots whatever they say
// (an empty one keeps its line), and a page shown again rewrites none of them.
describe('running heads kept in place', () => {
  it('keeps both slots of each, the same elements, through the front matter and back', () => {
    const heads = new RunningHeads();
    const label = ({ from }: PageShown) => String(from);
    const slots = [...heads.head.children, ...heads.folio.children];
    heads.show([{ role: 'text', from: 2500 }], EPUB, 4, label);
    heads.show(
      [
        { role: 'front', from: 0 },
        { role: 'front', from: 0 },
      ],
      EPUB,
      4,
      label,
    );
    heads.show([], null, -1, label);
    expect([...heads.head.children, ...heads.folio.children]).toEqual(slots);
    expect(slots.map((slot) => slot.textContent)).toEqual(['', '', '', '']);
  });

  it('rewrites nothing for the same pages shown again', () => {
    const heads = new RunningHeads();
    const sight = [
      { role: 'text', from: 2500 },
      { role: 'text', from: 3500 },
    ] as const;
    const label = ({ from }: PageShown) => String(Math.floor(from / 1000) + 1);
    heads.show(sight, EPUB, 4, label);
    const watched = new MutationObserver(() => {});
    for (const row of [heads.head, heads.folio]) {
      watched.observe(row, { subtree: true, childList: true, characterData: true });
    }
    heads.show(sight, EPUB, 4, label);
    expect(watched.takeRecords()).toEqual([]);
    watched.disconnect();
  });
});
