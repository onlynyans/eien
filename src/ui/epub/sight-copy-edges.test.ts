// A sight's words for a turn's copy (./sight-copy.ts) at its edges (QA): a
// run opened deep or lying in one block, a list's numbers, the cap, a rule
// to begin on, a pull up, and the copies it won't give.

import { afterEach, describe, expect, it } from 'vitest';
import { type BoxOf, RUN_CHARACTERS, sightCopy } from './sight-copy';
import { chapterOf, copied, PITCH, sight } from './test-sight-copy';

afterEach(() => document.body.replaceChildren());

describe('a sight’s words for a turn’s copy, at its edges', () => {
  it('opens each block the run begins inside, however deep, and copies the first one whole', () => {
    const { box, chapter, boxOf } = chapterOf(
      '<p>Before</p><div><p>Lead</p><blockquote><p>One</p><p>Two</p><p>Three</p></blockquote></div><p>After</p><p>Later</p>',
      {
        Before: { column: 0 },
        Lead: { column: 0 },
        One: { column: 1 },
        Two: { column: 2, top: 60 },
        Three: { column: 3 },
        After: { column: 4 },
        Later: { column: 4 },
      },
    );
    const { copy, from } = copied(chapter, { ...sight(box, 3), boxOf });
    const div = copy.querySelector(':scope > div:not(:first-child)') as HTMLElement;
    const quote = div.querySelector('blockquote') as HTMLElement;
    // Both drawn above the first block, on a page before: their tops taken off, and each one's
    // sibling before it kept as a shell, so a rule that looks back finds it.
    for (const opened of [div, quote]) {
      expect(opened.style.marginTop).toBe('0px');
      expect(opened.style.paddingTop).toBe('0px');
      expect(opened.style.borderTopWidth).toBe('0px');
      const shell = opened.previousElementSibling as HTMLElement;
      expect(shell.localName).toBe('p');
      expect(shell.style.display).toBe('none');
    }
    const first = [...quote.children].find((p) => p.textContent === 'Two') as HTMLElement;
    // The first block's own padding and border are on the page in sight: kept.
    expect(first.style.marginTop).toBe('0px');
    expect(first.style.paddingTop).toBe('');
    expect(first.style.borderTopWidth).toBe('');
    expect(copy.textContent).toBe('TwoThreeAfter');
    expect(from).toBe('BeforeLeadOne'.length);
  });

  it('puts a run that lies inside one block back in it, and in what holds that', () => {
    const { box, chapter, boxOf } = chapterOf(
      '<div><blockquote><p>One</p><p>Two</p><p>Three</p><p>Four</p></blockquote></div><p>After</p>',
      {
        One: { column: 0 },
        Two: { column: 2, top: 60 },
        Three: { column: 3 },
        Four: { column: 4 },
        After: { column: 6 },
      },
    );
    const { copy, from } = copied(chapter, { ...sight(box, 3), boxOf });
    const quote = copy.querySelector(':scope > div > blockquote') as HTMLElement;
    expect([...quote.children].map((p) => p.textContent)).toEqual(['', 'Two', 'Three', 'Four']);
    expect(quote.style.paddingTop).toBe('0px');
    expect(copy.textContent).not.toContain('After');
    expect(from).toBe('One'.length);
  });

  it('numbers an item the run begins inside by its place among the items alone, and only in a numbered list', () => {
    const at = {
      Note: { column: 0 },
      One: { column: 0 },
      Two: { column: 0 },
      More: { column: 1, top: 40 },
      Three: { column: 2 },
    };
    const html = (list: string) =>
      `<${list}><p>Note</p><li><p>One</p></li><li><p>Two</p><p>More</p></li><li><p>Three</p></li></${list}>`;
    const numbered = chapterOf(html('ol'), at);
    const { copy } = copied(numbered.chapter, { ...sight(numbered.box, 2), boxOf: numbered.boxOf });
    const opened = [...copy.querySelectorAll('li')].find((li) => li.style.display !== 'none');
    expect(opened?.textContent).toBe('More');
    // The list's paragraph before its items isn't one of them: the second item is 2.
    expect(opened?.getAttribute('value')).toBe('2');
    document.body.replaceChildren();
    const bulleted = chapterOf(html('ul'), at);
    const plain = copied(bulleted.chapter, { ...sight(bulleted.box, 2), boxOf: bulleted.boxOf });
    expect(plain.copy.querySelector('li[value]')).toBeNull();
  });

  it('counts its cap on the run, not the chapter: a long chapter’s page is copied', () => {
    const long = 'Words, '.repeat(RUN_CHARACTERS / 7 + 1).trim();
    const end = `${long}!`;
    const { box, chapter, boxOf } = chapterOf(
      `<p>${long}</p><p>One</p><p>Two</p><p>Three</p><p>Four</p><p>${end}</p>`,
      {
        [long]: { column: 0 },
        One: { column: 50 },
        Two: { column: 51, top: 40 },
        Three: { column: 52 },
        Four: { column: 53 },
        [end]: { column: 54 },
      },
    );
    const { copy } = copied(chapter, { ...sight(box, 52), boxOf });
    expect(copy.textContent).toBe('TwoThreeFour');
  });

  it('begins on a rule as on a word: the rule itself is what’s measured', () => {
    const { box, chapter, boxOf } = chapterOf('<p>One</p><hr><p>Two</p><p>Three</p>', {
      One: { column: 0 },
      Two: { column: 3 },
      Three: { column: 4 },
    });
    const rule = chapter.querySelector('hr') as Node;
    const page: BoxOf = (node) =>
      node === rule ? { left: 2 * PITCH + 10, top: 100 } : boxOf(node);
    // The run's rule, laid out of sight: 3px lower than its spacer leaves it, 5px right.
    const measured: BoxOf = (node) => {
      const probe = box.lastElementChild as HTMLElement;
      if (probe === chapter || !probe.contains(node)) return page(node);
      if (!(node instanceof HTMLHRElement)) return null;
      const spacer = probe.firstElementChild as HTMLElement;
      const shift = -Number.parseFloat(probe.style.transform.replace('translateX(', ''));
      return {
        left: 10 + (3 * PITCH - shift) + 5,
        top: Number.parseFloat(spacer.style.height) + 3,
      };
    };
    const { copy, shift } = copied(chapter, { ...sight(box, 3), boxOf: measured });
    expect(copy.querySelector('hr')).not.toBeNull();
    expect(Number.parseFloat((copy.firstElementChild as HTMLElement).style.height)).toBeCloseTo(
      97,
      2,
    );
    expect(shift).toBeCloseTo(PITCH + 5, 6);
    expect(box.children).toHaveLength(1);
  });

  it('pulls a first block up that a column’s head had none above, where it’s laid lower out of sight', () => {
    const { box, chapter, boxOf } = chapterOf('<p>One</p><p>Two</p><p>Three</p>', {
      One: { column: 0 },
      Two: { column: 2 },
      Three: { column: 3 },
    });
    // A margin the break dropped on the page but the run laid out of sight keeps: its words 3px
    // lower than the page's, until a spacer pulls them up by as much.
    const measured: BoxOf = (node) => {
      const probe = box.lastElementChild as HTMLElement;
      if (probe === chapter || !probe.contains(node)) return boxOf(node);
      if (node instanceof HTMLElement && node.style.display === 'none') return null;
      const first = probe.firstElementChild as HTMLElement;
      const pulled =
        first.localName === 'div'
          ? Number.parseFloat(first.style.height) + Number.parseFloat(first.style.marginBottom)
          : 0;
      return { left: 2 * PITCH + 10, top: pulled + 3 };
    };
    const { copy } = copied(chapter, { ...sight(box, 3), boxOf: measured });
    const spacer = copy.firstElementChild as HTMLElement;
    expect(spacer.localName).toBe('div');
    expect(spacer.style.height).toBe('0px');
    expect(Number.parseFloat(spacer.style.marginBottom)).toBeCloseTo(-3, 6);
    expect(spacer.nextElementSibling?.textContent).toBe('');
    expect(box.children).toHaveLength(1);
  });

  it('ends after a block that holds its first, where the next page begins on that block’s own words', () => {
    const { box, chapter, boxOf } = chapterOf(
      '<blockquote><p>One</p>Two words</blockquote><p>Later</p>',
      { One: { column: 1 }, 'Two words': { column: 3 }, Later: { column: 4 } },
    );
    const { copy } = copied(chapter, { ...sight(box, 2), boxOf });
    expect(copy.textContent).toContain('Two words');
    expect(copy.textContent).not.toContain('Later');
  });

  it('gives no copy where its first block has no box to set it by', () => {
    const { box, chapter, boxOf } = chapterOf('<p>One</p><p>Two</p><p>Three</p>', {
      One: { column: 0 },
      Two: { column: 1 },
      Three: { column: 3 },
    });
    const first = chapter.querySelectorAll('p')[1] as Node;
    const measured: BoxOf = (node) => (node === first ? null : boxOf(node));
    expect(sightCopy(chapter, { ...sight(box, 2), boxOf: measured })).toBeNull();
  });

  it('gives no copy where the run laid out of sight never comes to stand where the page has it', () => {
    const { box, chapter, boxOf } = chapterOf('<p>One</p><p>Two</p><p>Three</p>', {
      One: { column: 0 },
      Two: { column: 2, top: 120 },
      Three: { column: 3 },
    });
    // Its words 5px low however its spacer stands: nothing the spacer does reaches them.
    const measured: BoxOf = (node) => {
      const probe = box.lastElementChild as HTMLElement;
      if (probe === chapter || !probe.contains(node)) return boxOf(node);
      return { left: 10, top: 125 };
    };
    expect(sightCopy(chapter, { ...sight(box, 3), boxOf: measured })).toBeNull();
    expect(box.children).toHaveLength(1);
  });
});
