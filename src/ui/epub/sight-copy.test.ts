// A sight's words for a turn's copy (./sight-copy.ts), on the tests' own
// layout: happy-dom lays nothing out, so each test says where each thing's
// first box is. Columns are 340px apart (300 and a 40px gap).

import { afterEach, describe, expect, it } from 'vitest';
import { type BoxOf, RUN_CHARACTERS, type SightCopyOf, sightCopy } from './sight-copy';

const PITCH = 340;
/** A quarter of a layout unit: what the spacer's height is given over its measure. */
const OVER = 1 / 256;

interface Place {
  readonly column: number;
  readonly top?: number;
}

/** `html` as a chapter laid from the window's left, each text named standing where it's placed. */
function chapterOf(html: string, at: Readonly<Record<string, Place>>) {
  const box = document.createElement('div');
  const chapter = document.createElement('div');
  chapter.innerHTML = html;
  box.append(chapter);
  document.body.append(box);
  chapter.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
  /** A node's box: its own words' place, or else the first named text in it or after it. */
  const boxOf: BoxOf = (node) => {
    const walk = document.createTreeWalker(chapter, NodeFilter.SHOW_TEXT);
    for (let text = walk.nextNode(); text; text = walk.nextNode()) {
      const follows =
        text === node ||
        node.contains(text) ||
        node.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING;
      const place = at[text.textContent?.trim() ?? ''];
      if (!follows || !place) continue;
      return { left: place.column * PITCH + 10, top: place.top ?? 0 };
    }
    return null;
  };
  return { box, chapter, boxOf };
}

/** The sight beginning at column `column`, one page wide, the page moved there. */
const sight = (box: HTMLElement, column: number, scale = 1): SightCopyOf => ({
  box,
  from: (column * PITCH - 20) * scale,
  past: ((column + 1) * PITCH - 20) * scale,
  at: column * PITCH,
  pitch: PITCH,
  scale,
});

function copied(chapter: HTMLElement, of: SightCopyOf) {
  const sight = sightCopy(chapter, of);
  if (!sight) throw new Error('no copy');
  const copy = document.createElement('div');
  copy.append(sight.words);
  return { copy, shift: sight.shift, from: sight.from };
}

afterEach(() => document.body.replaceChildren());

describe('a sight’s words for a turn’s copy', () => {
  it('holds the whole blocks from the one the page before ends in to the one the next page begins in', () => {
    const { box, chapter, boxOf } = chapterOf(
      '<p>One</p><p>Two</p><p>Three</p><p>Four</p><p>Five</p>',
      {
        One: { column: 0 },
        Two: { column: 2, top: 120 },
        Three: { column: 3 },
        Four: { column: 4 },
        Five: { column: 5 },
      },
    );
    const { copy, from } = copied(chapter, { ...sight(box, 3), boxOf });
    expect([...copy.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      '',
      'Two',
      'Three',
      'Four',
    ]);
    expect(from).toBe('One'.length);
    // Measured out of sight in the chapter's box, and taken away again.
    expect(box.children).toHaveLength(1);
  });

  it('stands its first block where the page has it: down its column, and moved across to it', () => {
    const { box, chapter, boxOf } = chapterOf('<p>One</p><p>Two</p><p>Three</p>', {
      One: { column: 0 },
      Two: { column: 2, top: 120 },
      Three: { column: 3 },
    });
    const { copy, shift } = copied(chapter, { ...sight(box, 3), boxOf });
    const spacer = copy.firstElementChild as HTMLElement;
    expect(spacer.localName).toBe('div');
    expect(Number.parseFloat(spacer.style.height)).toBeCloseTo(120 + OVER, 5);
    // The copy's first column is the page's third: moved a column less far.
    expect(shift).toBe(PITCH);
    // Zoomed, the rects' pixels are the zoom's; the spacer's and the shift the chapter's own.
    const zoomed = copied(chapter, {
      ...sight(box, 3, 2),
      boxOf: (node) => {
        const place = boxOf(node);
        return place && { left: place.left * 2, top: place.top * 2 };
      },
    });
    expect(
      Number.parseFloat((zoomed.copy.firstElementChild as HTMLElement).style.height),
    ).toBeCloseTo((240 + OVER) / 2, 5);
    expect(zoomed.shift).toBe(PITCH);
  });

  it('sets its first word on the page’s, measured: a margin the layout collapsed, a part of a pixel across', () => {
    // A scene break before it: its hidden shell, which has no box, isn't what's measured.
    const { box, chapter, boxOf } = chapterOf(
      '<p>One</p><div class="scene-break"></div><p>Two</p><p>Three</p>',
      {
        One: { column: 0 },
        Two: { column: 2, top: 120 },
        Three: { column: 3 },
      },
    );
    // The run laid out of sight: its words stand 3px lower than its spacer (a margin come through
    // it) and 5px right of where they'd be if columns were laid at exactly the pitch.
    const measured: BoxOf = (node) => {
      const probe = box.lastElementChild as HTMLElement;
      if (probe === chapter || !probe.contains(node)) return boxOf(node);
      if (node instanceof HTMLElement && node.style.display === 'none') return null;
      const spacer = probe.firstElementChild as HTMLElement;
      const shift = -Number.parseFloat(probe.style.transform.replace('translateX(', ''));
      return {
        // The page's chapter here stands unmoved: the probe's words where its shift leaves them.
        left: 10 + (3 * PITCH - shift) + 5,
        top: Number.parseFloat(spacer.style.height) + 3,
      };
    };
    const { copy, shift } = copied(chapter, { ...sight(box, 3), boxOf: measured });
    expect(Number.parseFloat((copy.firstElementChild as HTMLElement).style.height)).toBeCloseTo(
      117,
      2,
    );
    expect(shift).toBeCloseTo(PITCH + 5, 6);
  });

  it('puts no spacer above a first block that stands at its column’s head', () => {
    const { box, chapter, boxOf } = chapterOf('<p>One</p><p>Two</p><p>Three</p>', {
      One: { column: 0 },
      Two: { column: 2 },
      Three: { column: 3 },
    });
    const { copy } = copied(chapter, { ...sight(box, 3), boxOf });
    const [shell, first] = copy.children;
    expect((shell as HTMLElement).style.display).toBe('none');
    expect(first?.textContent).toBe('Two');
  });

  it('keeps the paragraph before its first as a hidden shell, so it’s indented as one after another', () => {
    const { box, chapter, boxOf } = chapterOf('<p>One</p><p class="x">Two</p><p>Three</p>', {
      One: { column: 0 },
      Two: { column: 1, top: 40 },
      Three: { column: 2 },
    });
    const { copy } = copied(chapter, { ...sight(box, 2), boxOf });
    const [shell, first] = copy.querySelectorAll('p');
    expect(shell?.textContent).toBe('');
    expect(shell?.style.display).toBe('none');
    expect(shell?.nextElementSibling).toBe(first);
    expect(first?.textContent).toBe('Two');
    expect(first?.className).toBe('x');
    expect(first?.style.marginTop).toBe('0px');
  });

  it('puts the run back in the blocks it lies in, their tops (drawn on a page before) taken off', () => {
    const { box, chapter, boxOf } = chapterOf(
      '<p>Before</p><blockquote><p>One</p><p>Two</p><p>Three</p></blockquote><p>After</p><p>Later</p>',
      {
        Before: { column: 0 },
        One: { column: 1 },
        Two: { column: 2, top: 60 },
        Three: { column: 3 },
        After: { column: 4 },
        Later: { column: 4 },
      },
    );
    const { copy } = copied(chapter, { ...sight(box, 3), boxOf });
    const quote = copy.querySelector('blockquote') as HTMLElement;
    expect(quote).not.toBeNull();
    expect(quote.style.marginTop).toBe('0px');
    expect(quote.style.paddingTop).toBe('0px');
    expect(quote.style.borderTopWidth).toBe('0px');
    // The blockquote's own shell before it, and the paragraph's before the first.
    expect((quote.previousElementSibling as HTMLElement).style.display).toBe('none');
    expect([...quote.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      '',
      'Two',
      'Three',
    ]);
    // The next page begins on the paragraph after it: that's the run's last.
    expect(copy.textContent).toContain('After');
    expect(copy.textContent).not.toContain('Later');
  });

  it('numbers a list’s items from where the page’s stand', () => {
    const { box, chapter, boxOf } = chapterOf(
      '<ol><li>One</li><li>Two</li><li>Three</li><li>Four</li></ol>',
      { One: { column: 0 }, Two: { column: 0 }, Three: { column: 1 }, Four: { column: 2 } },
    );
    const { copy } = copied(chapter, { ...sight(box, 2), boxOf });
    const items = [...copy.querySelectorAll('li')].filter((li) => li.style.display !== 'none');
    expect(items.map((li) => [li.textContent, li.getAttribute('value')])).toEqual([
      ['Three', '3'],
      ['Four', null],
    ]);
  });

  it('starts at the chapter’s start on its first sight, in the page’s own place', () => {
    const { box, chapter, boxOf } = chapterOf('<p>One</p><p>Two</p><p>Three</p>', {
      One: { column: 0 },
      Two: { column: 1 },
      Three: { column: 5 },
    });
    const { copy, shift, from } = copied(chapter, { ...sight(box, 0), boxOf });
    expect(copy.firstElementChild?.localName).toBe('p');
    expect(copy.textContent).toBe('OneTwo');
    expect(shift).toBe(0);
    expect(from).toBe(0);
  });

  it('bounds the run by pictures and breaks, which hold no words', () => {
    const { box, chapter, boxOf } = chapterOf(
      '<p>One</p><figure><img alt=""></figure><hr><p>Two</p>',
      { One: { column: 0 }, Two: { column: 9 } },
    );
    // The picture and the rule have boxes of their own: the picture on column 1, the rule on 3.
    const boxes = new Map<Node, { left: number; top: number }>([
      [chapter.querySelector('img') as Node, { left: PITCH + 10, top: 0 }],
      [chapter.querySelector('figure') as Node, { left: PITCH + 10, top: 0 }],
      [chapter.querySelector('hr') as Node, { left: 3 * PITCH + 10, top: 0 }],
    ]);
    const measured: BoxOf = (node) => boxes.get(node) ?? boxOf(node);
    const { copy, shift } = copied(chapter, { ...sight(box, 2), boxOf: measured });
    // The picture's page is the page before: its block first; the rule begins the next page, and
    // the words after it are left out.
    expect(copy.querySelector('figure')).not.toBeNull();
    expect(copy.querySelector('hr')).not.toBeNull();
    expect(copy.textContent).not.toContain('Two');
    expect(shift).toBe(PITCH);
  });

  it('never starts late or ends early for what has no box', () => {
    const { box, chapter, boxOf } = chapterOf('<p>One</p><p>Two</p><p>Three</p><p>Four</p>', {
      One: { column: 0 },
      Three: { column: 3 },
      Four: { column: 9 },
    });
    // "Two" has no box: it may be before the sight or in it, so the run starts at "One"; past the
    // sight, a box-less one would be kept.
    const { copy } = copied(chapter, { ...sight(box, 3), boxOf });
    expect(copy.textContent).toContain('One');
    expect(copy.textContent).toContain('Three');
  });

  it('gives no copy of a run longer than a copy may be: one block as long as a chapter', () => {
    const long = chapterOf(`<p>${'Words, '.repeat(RUN_CHARACTERS / 7 + 1)}</p>`, {});
    expect(sightCopy(long.chapter, { ...sight(long.box, 2), boxOf: long.boxOf })).toBeNull();
    // As long as a copy may be, it's copied.
    const most = chapterOf(`<p>${'Words, '.repeat(RUN_CHARACTERS / 7 - 1)}</p>`, {});
    expect(sightCopy(most.chapter, { ...sight(most.box, 2), boxOf: most.boxOf })).not.toBeNull();
  });
});
