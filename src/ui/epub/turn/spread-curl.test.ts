// A curl on two facing pages (#40, Phase 3d): one page turns round the
// gutter, its running head with it, the other lying still until it lands; a
// back turn is the forward one in a mirror, so a hand drawn rightward on the
// left page turns it back. And the copies a curl lays keep beneath their
// paper, so a page's back shows its words faintly.

import { afterEach, describe, expect, it } from 'vitest';
import { ChapterSheet } from '../chapter-sheet';
import type { Frames } from './next-frame';
import { PageTurn } from './page-turn';
import type { TurnLeaf } from './turn-surface';
import type { TurnTokens } from './turn-tokens';

const TOKENS: TurnTokens = { calm: 220, quick: 120, ease: 'linear', step: 8, cast: 32, crest: 24 };
/** A sheet 800 wide holding two pages, its gutter at 400. */
const WIDTH = 800;
const GUTTER = 400;

function spread(
  leafOf: (way: 1 | -1) => TurnLeaf | null = (way) =>
    way > 0
      ? { x: GUTTER, width: WIDTH - GUTTER, mirrored: false }
      : { x: 0, width: GUTTER, mirrored: true },
) {
  const host = document.createElement('div');
  const sheet = document.createElement('article');
  sheet.innerHTML = '<div class="heads">Chapter I</div><p class="words">Page 1</p>';
  Object.defineProperty(sheet, 'offsetWidth', { value: WIDTH });
  Object.defineProperty(sheet, 'offsetHeight', { value: 600 });
  host.append(sheet);
  document.body.append(host);
  let page = 3;
  let started = page;
  const queue = new Set<(now: number) => void>();
  const frames: Frames = (run) => {
    queue.add(run);
    return () => queue.delete(run);
  };
  let now = 0;
  const turn = new PageTurn(
    {
      sheet: () => sheet,
      words: '.words',
      step: (way) => {
        started = page;
        page += way;
        return true;
      },
      unstep: () => {
        page = started;
      },
      how: () => ({ style: 'curl', speed: 1 }),
      leaf: leafOf,
    },
    { frames, tokens: () => TOKENS, random: () => 0.5 },
  );
  made.push(turn);
  const run = (limit = 400) => {
    for (let i = 0; i < limit && queue.size > 0; i++) {
      now += 16;
      const due = [...queue];
      queue.clear();
      for (const frame of due) frame(now);
    }
  };
  return {
    turn,
    host,
    sheet,
    run,
    page: () => page,
    /** `count` frames run, no more: a turn caught in flight. */
    frames: (count: number) => run(count),
    curl: () => host.querySelector<HTMLElement>('.turn-curl'),
  };
}

const made: PageTurn[] = [];
afterEach(() => {
  for (const turn of made.splice(0)) turn.dispose();
  document.body.replaceChildren();
});

describe('a curl on two facing pages', () => {
  it('turns the right page on round the gutter, the left lying still as it was until it lands', () => {
    const b = spread();
    b.turn.key(1);
    const curl = b.curl() as HTMLElement;
    const leaf = curl.querySelector<HTMLElement>('.turn-curl__leaf') as HTMLElement;
    expect(leaf.style.left).toBe(`${GUTTER}px`);
    expect(leaf.style.width).toBe(`${WIDTH - GUTTER}px`);
    expect(leaf.style.transform).toBe('');
    // Each piece holds the whole page laid so the right page fills the leaf: its running head too.
    const copy = leaf.querySelector<HTMLElement>('.turn-curl__strip .turn-curl__page');
    expect(copy?.style.left).toBe(`${-GUTTER}px`);
    expect(copy?.querySelector('.heads')?.textContent).toBe('Chapter I');
    // The left page, as it was, over the new one until the turn lands.
    const still = curl.querySelector<HTMLElement>('.turn-curl__still') as HTMLElement;
    expect(still.style.clipPath).toBe(`inset(0 ${WIDTH - GUTTER}px 0 0)`);
    expect(b.sheet.style.visibility).toBe('');
    b.run();
    expect(b.curl()).toBeNull();
    expect(b.page()).toBe(4);
  });

  it('turns the left page back as the right turns on, in a mirror, the right lying still', () => {
    const b = spread();
    b.turn.key(-1);
    const curl = b.curl() as HTMLElement;
    const leaf = curl.querySelector<HTMLElement>('.turn-curl__leaf') as HTMLElement;
    expect(leaf.style.left).toBe('0px');
    expect(leaf.style.width).toBe(`${GUTTER}px`);
    expect(leaf.style.transform).toBe('scaleX(-1)');
    // Its words read the right way round: mirrored again, about the leaf's middle.
    const copy = leaf.querySelector<HTMLElement>('.turn-curl__front .turn-curl__page');
    expect(copy?.style.transform).toBe('scaleX(-1)');
    expect(copy?.style.transformOrigin).toBe(`${GUTTER / 2}px 0`);
    const still = curl.querySelector<HTMLElement>('.turn-curl__still') as HTMLElement;
    expect(still.style.clipPath).toBe(`inset(0 0 0 ${GUTTER}px)`);
    b.run();
    expect(b.page()).toBe(2);
  });

  it('turns the left page back under a hand drawn rightward across it, as the right turns on leftward', () => {
    const b = spread();
    b.turn.grab([20, 300]);
    b.turn.drag([8, 0], 0);
    b.turn.drag([120, 0], 10);
    b.turn.drag([300, 0], 20);
    expect(b.page()).toBe(2);
    expect(b.turn.letGo()).toBe(true);
    b.run();
    // Turned over, not fallen back: in its mirror the hand went the way a turn goes.
    expect(b.page()).toBe(2);
    expect(b.curl()).toBeNull();
  });

  it('turns the whole sheet where it holds one page', () => {
    const b = spread(() => null);
    b.turn.key(1);
    const curl = b.curl() as HTMLElement;
    expect(curl.querySelector('.turn-curl__leaf')).toBeNull();
    expect(curl.querySelector('.turn-curl__still')).toBeNull();
    const copy = curl.querySelector<HTMLElement>('.turn-curl__strip .turn-curl__page');
    expect(copy?.style.left).toBe('0px');
  });
});

describe('a curl’s copies', () => {
  it('each sit in a band with the paper over them, so a page’s back shows its words faintly', () => {
    const b = spread(() => null);
    b.turn.key(1);
    const back = b.curl()?.querySelector<HTMLElement>('.turn-curl__back') as HTMLElement;
    // How they stack is ./turn.css's, which the phone's page checks laid out (tests/mobile).
    const inside = ':scope > .turn-curl__inside';
    expect(back.querySelector(`${inside} > .turn-curl__page`)).not.toBeNull();
    expect(back.querySelector(`${inside} > .turn-curl__paper`)).not.toBeNull();
  });
});

describe('a curl caught on two facing pages', () => {
  // QA (#40, spread curl): a mirrored page caught in flight follows the hand as in its mirror: drawn
  // leftward, back the way it came, so the turn falls back home.
  it('falls back home under a hand drawn leftward across the left page caught mid-turn', () => {
    const b = spread();
    b.turn.key(-1);
    b.frames(4);
    expect(b.turn.catchable).toBe(true);
    b.turn.grab([200, 300]);
    b.turn.drag([-8, 0], 100);
    b.turn.drag([-200, 0], 110);
    b.turn.drag([-400, 0], 120);
    b.turn.letGo();
    b.run();
    expect(b.curl()).toBeNull();
    expect(b.page()).toBe(3);
  });

  // QA (#40, spread curl): caught and let go without a drag, it flies on and lands where it was going.
  it('flies on, caught and let go without a drag', () => {
    const b = spread();
    b.turn.key(-1);
    b.frames(4);
    b.turn.grab([200, 300]);
    expect(b.turn.letGo()).toBe(false);
    b.run();
    expect(b.curl()).toBeNull();
    expect(b.page()).toBe(2);
  });
});

describe('a curl on one page', () => {
  // QA (#40, spread curl): one page's back turn as before the spread's: the page left beneath them all
  // (z 0), the page come laid over it as the curl's pieces from 1, the sheet hidden until it lands.
  it('turns back with the page left beneath, the sheet hidden until it lands', () => {
    const b = spread(() => null);
    b.turn.key(-1);
    const curl = b.curl() as HTMLElement;
    const pieces = [...curl.children] as HTMLElement[];
    expect(pieces.map((piece) => piece.style.zIndex)).toEqual(pieces.map((_, i) => String(i)));
    expect(pieces[0]?.classList.contains('turn-curl__under')).toBe(true);
    expect(curl.querySelector<HTMLElement>('.turn-curl__flap')?.style.zIndex).toBe(
      String(pieces.length - 1),
    );
    expect(b.sheet.style.visibility).toBe('hidden');
    b.run();
    expect(b.sheet.style.visibility).toBe('');
    expect(b.page()).toBe(2);
  });

  // QA (#40, spread curl): and its turn on, the curl's pieces from 1 over the sheet, which isn't hidden.
  it('turns on over the sheet, which stays in sight beneath', () => {
    const b = spread(() => null);
    b.turn.key(1);
    const pieces = [...(b.curl() as HTMLElement).children] as HTMLElement[];
    expect(pieces.map((piece) => piece.style.zIndex)).toEqual(pieces.map((_, i) => String(i + 1)));
    expect(b.sheet.style.visibility).toBe('');
  });
});

// QA (#40, spread curl): the gutter a curl turns round is only a spread's, in pages: one page or
// Scroll turns the whole sheet; on a spread, the middle of the pages' box across the sheet.
describe('a sheet’s gutter', () => {
  const sheetOf = () => {
    const scroller = document.createElement('div');
    const sheet = new ChapterSheet({
      scroller,
      dock: document.createElement('div'),
      copy: () => {},
      moved: () => {},
      rested: () => {},
      inSight: () => {},
      follow: () => {},
      quote: () => {},
      highlight: () => {},
      inHighlight: () => false,
      copied: () => {},
    });
    Object.defineProperty(sheet.box, 'offsetLeft', { value: 32 });
    Object.defineProperty(sheet.box, 'offsetWidth', { value: 640 });
    return sheet;
  };

  it('is none in Scroll, even with two pages marked', () => {
    const sheet = sheetOf();
    sheet.box.setAttribute('data-spread', '');
    expect(sheet.gutter).toBeNull();
  });

  it('is none in pages one at a time', () => {
    const sheet = sheetOf();
    sheet.paged = true;
    expect(sheet.gutter).toBeNull();
  });

  it('is the middle of the pages’ box on a spread', () => {
    const sheet = sheetOf();
    sheet.paged = true;
    sheet.box.setAttribute('data-spread', '');
    expect(sheet.gutter).toBe(32 + 320);
  });
});
