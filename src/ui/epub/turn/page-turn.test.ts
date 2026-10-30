import { afterEach, describe, expect, it } from 'vitest';
import type { Frames } from './next-frame';
import { PageTurn, type TurnStyle } from './page-turn';
import type { TurnTokens } from './turn-tokens';

const TOKENS: TurnTokens = { calm: 220, quick: 120, ease: 'linear', step: 8, cast: 32, crest: 24 };
const STILL: TurnTokens = { ...TOKENS, calm: 0, quick: 0 };

/** A book of `pages` pages on one sheet, the turn over it, and the frames run by hand. */
function book({
  style = 'curl' as TurnStyle,
  speed = 1,
  tokens = TOKENS,
  pages = 5,
  later = false,
} = {}) {
  const host = document.createElement('div');
  const sheet = document.createElement('article');
  sheet.className = 'sheet';
  sheet.innerHTML =
    '<p class="words"><a id="mark" data-anchor="n1" tabindex="0" href="#x">Page 1</a></p>';
  for (const [name, value] of [
    ['offsetWidth', 400],
    ['offsetHeight', 600],
  ] as const) {
    Object.defineProperty(sheet, name, { value, configurable: true });
  }
  host.append(sheet);
  document.body.append(host);
  let page = 1;
  const steps: number[] = [];
  let started = 1;
  const show = () => {
    (sheet.querySelector('a') as HTMLElement).textContent = `Page ${page}`;
  };
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
        const go = () => {
          if (page + way < 1 || page + way > pages) return false;
          started = page;
          page += way;
          steps.push(way);
          show();
          return true;
        };
        // Into another chapter: once it's drawn.
        return later ? new Promise<boolean>((done) => setTimeout(() => done(go()), 1)) : go();
      },
      unstep: () => {
        page = started;
        show();
      },
      how: () => ({ style, speed }),
    },
    { frames, tokens: () => tokens, random: () => 0.5 },
  );
  /** Runs frames 16 ms apart until none are asked for, or `limit`. */
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
    steps,
    page: () => page,
    curl: () => host.querySelector('.turn-curl'),
    copies: () => host.querySelectorAll('.turn-copy').length,
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('a key’s turn under Curl', () => {
  it('moves the book on at once and curls the page left over it, then lands', () => {
    const b = book();
    b.turn.key(1);
    expect(b.page()).toBe(2);
    expect(b.curl()).not.toBeNull();
    expect(b.turn.turning).toBe(true);
    b.run();
    expect(b.curl()).toBeNull();
    expect(b.turn.turning).toBe(false);
    expect(b.page()).toBe(2);
  });

  it('copies the page as unreachable: hidden, inert, nothing found by name', () => {
    const b = book();
    b.turn.key(1);
    const curl = b.curl() as HTMLElement;
    expect(curl.getAttribute('aria-hidden')).toBe('true');
    const copy = curl.querySelector('.turn-copy') as HTMLElement;
    expect(copy.inert).toBe(true);
    expect(curl.querySelector('[id], [data-anchor], [tabindex]')).toBeNull();
    // The book's own words, the copy's, only once in the sheet itself.
    expect(b.host.querySelectorAll('#mark')).toHaveLength(1);
  });

  it('pressed again mid-turn, finishes the first at once and starts the next', () => {
    const b = book();
    b.turn.key(1);
    b.run(2);
    b.turn.key(1);
    expect(b.page()).toBe(3);
    expect(b.host.querySelectorAll('.turn-curl')).toHaveLength(1);
  });

  it('back, the page before curls back over this one, which waits hidden beneath', () => {
    const b = book();
    b.turn.key(1);
    b.turn.finish();
    b.turn.key(-1);
    expect(b.page()).toBe(1);
    expect(b.sheet.style.visibility).toBe('hidden');
    b.run();
    expect(b.sheet.style.visibility).toBe('');
  });

  it('does nothing at the book’s end', () => {
    const b = book({ pages: 1 });
    b.turn.key(1);
    expect(b.page()).toBe(1);
    expect(b.curl()).toBeNull();
    expect(b.copies()).toBe(0);
  });
});

describe('a hand under Curl', () => {
  it('a small move is no drag; past it the page is held, under the hand', () => {
    const b = book();
    b.turn.grab([390, 500]);
    b.turn.drag([-4, 0], 0);
    expect(b.curl()).toBeNull();
    b.turn.drag([-60, 0], 10);
    expect(b.page()).toBe(2);
    expect(b.curl()).not.toBeNull();
    b.run(1);
    expect(b.curl()).not.toBeNull();
  });

  it('let go slowly short of a quarter, it falls back, and the book is where it was', () => {
    const b = book();
    b.turn.grab([390, 500]);
    b.turn.drag([-60, 0], 0);
    b.turn.drag([-60, 0], 80);
    expect(b.turn.letGo()).toBe(true);
    b.run();
    expect(b.curl()).toBeNull();
    expect(b.page()).toBe(1);
  });

  it('let go past it, it turns', () => {
    const b = book();
    b.turn.grab([390, 500]);
    b.turn.drag([-300, 0], 0);
    b.turn.drag([-340, 0], 80);
    b.turn.letGo();
    b.run();
    expect(b.page()).toBe(2);
  });

  it('a press with no drag is a click, not a turn', () => {
    const b = book();
    b.turn.grab([390, 500]);
    expect(b.turn.letGo()).toBe(false);
    expect(b.page()).toBe(1);
  });

  it('catches a page in flight, and carries it back', () => {
    const b = book();
    b.turn.key(1);
    b.run(2);
    b.turn.grab([200, 400]);
    b.run(3);
    expect(b.curl()).not.toBeNull();
    b.turn.drag([300, 0], 0);
    b.turn.drag([300, 0], 80);
    b.turn.letGo();
    b.run();
    expect(b.curl()).toBeNull();
    expect(b.page()).toBe(1);
  });

  it('at speed 0, a drag still follows the hand and the finish is at once', () => {
    const b = book({ speed: 0 });
    b.turn.key(1);
    expect(b.curl()).toBeNull();
    b.turn.grab([390, 500]);
    b.turn.drag([-300, 0], 0);
    expect(b.curl()).not.toBeNull();
    b.turn.drag([-340, 0], 80);
    b.turn.letGo();
    b.run(1);
    expect(b.curl()).toBeNull();
    expect(b.page()).toBe(3);
  });
});

describe('reduced motion (the tokens at 0)', () => {
  it('a key changes the page at once, with nothing laid over it', () => {
    const b = book({ tokens: STILL });
    b.turn.key(1);
    expect(b.page()).toBe(2);
    expect(b.curl()).toBeNull();
    expect(b.copies()).toBe(0);
  });

  it('a drag asks for the turn and nothing is held', () => {
    const b = book({ tokens: STILL });
    b.turn.grab([390, 500]);
    b.turn.drag([-40, 0], 0);
    expect(b.page()).toBe(2);
    expect(b.curl()).toBeNull();
    b.turn.drag([-300, 0], 20);
    expect(b.page()).toBe(2);
    expect(b.turn.letGo()).toBe(true);
  });
});

describe('Slide and Words', () => {
  it('Slide carries the words: the page’s copy, words alone, over the sheet till it’s done', () => {
    const b = book({ style: 'slide' });
    b.turn.key(1);
    expect(b.page()).toBe(2);
    const copy = b.host.querySelector('.turn-copy--words') as HTMLElement;
    expect(copy).not.toBeNull();
    expect(copy.querySelector('[data-turn-words]')?.textContent).toBe('Page 1');
    expect(b.curl()).toBeNull();
    b.turn.finish();
    expect(b.copies()).toBe(0);
    expect(b.turn.turning).toBe(false);
  });

  it('Words: a key pressed mid-turn finishes it and starts the next', () => {
    const b = book({ style: 'words' });
    b.turn.key(1);
    b.turn.key(1);
    expect(b.page()).toBe(3);
    expect(b.copies()).toBe(1);
  });

  it('under Words a drag asks for the turn, as a key does, and holds nothing', () => {
    const b = book({ style: 'words' });
    b.turn.grab([390, 500]);
    b.turn.drag([-30, 0], 0);
    expect(b.page()).toBe(2);
    expect(b.curl()).toBeNull();
    expect(b.host.querySelector('.turn-copy--words')).not.toBeNull();
    b.turn.drag([-300, 0], 20);
    expect(b.steps).toEqual([1]);
  });

  it('a drag rightward asks for the page before', () => {
    const b = book({ style: 'words' });
    b.turn.key(1);
    b.turn.finish();
    b.turn.grab([10, 500]);
    b.turn.drag([30, 0], 0);
    expect(b.page()).toBe(1);
    expect(b.turn.letGo()).toBe(true);
  });

  it('at speed 0, nothing is laid over the page', () => {
    const b = book({ style: 'slide', speed: 0 });
    b.turn.key(1);
    expect(b.page()).toBe(2);
    expect(b.copies()).toBe(0);
  });
});

const drawn = () => new Promise((done) => setTimeout(done, 5));

describe('into another chapter, drawn first', () => {
  it('the turn waits for the next page, then runs', async () => {
    const b = book({ later: true });
    b.turn.key(1);
    expect(b.page()).toBe(1);
    expect(b.curl()).toBeNull();
    await drawn();
    expect(b.page()).toBe(2);
    expect(b.curl()).not.toBeNull();
  });

  it('keys pressed meanwhile wait their turn, none lost', async () => {
    const b = book({ later: true });
    b.turn.key(1);
    b.turn.key(1);
    await drawn();
    await drawn();
    expect(b.steps).toEqual([1, 1]);
    expect(b.host.querySelectorAll('.turn-curl')).toHaveLength(1);
  });

  it('a hand lifted before the page came still throws its curl', async () => {
    const b = book({ later: true });
    b.turn.grab([390, 500]);
    b.turn.drag([-300, 0], 0);
    b.turn.drag([-340, 0], 80);
    expect(b.turn.letGo()).toBe(true);
    await drawn();
    expect(b.curl()).not.toBeNull();
    b.run();
    expect(b.curl()).toBeNull();
    expect(b.page()).toBe(2);
  });
});

describe('never in the way', () => {
  it('a key held down turns at once, with nothing laid over the page', () => {
    const b = book();
    b.turn.key(1, true);
    expect(b.page()).toBe(2);
    expect(b.curl()).toBeNull();
    expect(b.copies()).toBe(0);
  });

  it('the window hidden: the turn lands now', () => {
    const b = book();
    b.turn.key(1);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    expect(b.curl()).toBeNull();
    expect(b.page()).toBe(2);
  });

  it('let go, nothing is left on the page', () => {
    const b = book();
    b.turn.key(1);
    b.turn.dispose();
    expect(b.curl()).toBeNull();
    b.turn.key(1);
    expect(b.page()).toBe(2);
  });
});
