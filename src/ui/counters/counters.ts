// The colophon's counters (spec §4): today's words on this device, the
// book's words against its goal, and a sprint's time left and words gained.
// Today's tally and a sprint under way are this device's, kept in the
// window's own storage (spec §2), so a restart keeps them. A sprint ends
// quietly: the colophon says so, and one line of news (spec §1).

import {
  clock,
  inSprint,
  readSprint,
  readTally,
  type Sprint,
  type SprintMinutes,
  signed,
  sprintLeft,
  startSprint,
  type Tally,
  tallied,
  todayWords,
  untilMidnight,
} from '../../core/counters';
import { h } from '../dom';
import type { Written } from '../page/word-count';

const TALLY_KEY = 'eien.today';
const SPRINT_KEY = 'eien.sprint';

/** How long a sprint that's over stays in the colophon after a restart: one found later is gone. */
const DONE_FOR = 60 * 60_000;

/** A book's words, the open note's live, and its goal. */
export interface BookShown {
  readonly words: number;
  readonly goal?: number;
}

export interface CountersParts {
  /** One line of news: a sprint is over. */
  tell(message: string): void;
  /** Count what the writer has written now, without waiting for a pause (a sprint's end). */
  flushWriting?(): void;
  /** The time now, in milliseconds (a test's own clock). */
  now?(): number;
}

/** What's kept in the window's storage, or null: private windows and full disks refuse it. */
function kept(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function keep(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not kept: the count goes on in this window.
  }
}

export class Counters {
  readonly element: HTMLElement;
  readonly #today = h('span', { class: 'colophon__today' });
  readonly #book = h('span', { class: 'colophon__book' });
  readonly #sprint = h('span', { class: 'colophon__sprint' });
  readonly #parts: CountersParts;
  #tally: Tally | null = readTally(kept(TALLY_KEY));
  #sprintOn: Sprint | null = readSprint(kept(SPRINT_KEY));
  #ticking: ReturnType<typeof setInterval> | undefined;
  #midnight: ReturnType<typeof setTimeout> | undefined;

  constructor(parts: CountersParts) {
    this.#parts = parts;
    this.element = h('span', { class: 'counters' }, this.#today, this.#book, this.#sprint);
    // Another window here wrote words, or started a sprint: this one shows it too.
    globalThis.addEventListener?.('storage', this.#heard);
    // A sprint that was over long before this window opened isn't news any more.
    if (this.#sprintOn && this.#sprintOn.ends + DONE_FOR < this.#now()) this.stopSprint();
    this.#showToday();
    this.#tick();
  }

  #now(): number {
    return this.#parts.now?.() ?? Date.now();
  }

  /**
   * Words written (or, below 0, cut) by the writer, here; `when` they were
   * written decides a sprint's (the last burst before its end is its own).
   */
  wrote(added: number, when?: Written): void {
    const now = this.#now();
    // Read again first: another window here may have written since this one last did.
    this.#tally = tallied(readTally(kept(TALLY_KEY)) ?? this.#tally, new Date(now), added);
    keep(TALLY_KEY, this.#tally);
    this.#showToday();
    const sprint = readSprint(kept(SPRINT_KEY)) ?? this.#sprintOn;
    if (sprint && inSprint(sprint, when?.from ?? now, when?.to ?? now)) {
      this.#sprintOn = { ...sprint, words: sprint.words + added };
      keep(SPRINT_KEY, this.#sprintOn);
      this.#showSprint();
    }
  }

  /** The open note's book, or none. */
  showBook(book: BookShown | null): void {
    this.#book.textContent = book
      ? `Book ${book.words.toLocaleString()}${book.goal ? ` / ${book.goal.toLocaleString()}` : ''}`
      : '';
  }

  /** Whether a sprint is under way: one over (still shown, "done") isn't. */
  get sprinting(): boolean {
    return this.#sprintOn !== null && this.#now() < this.#sprintOn.ends;
  }

  /** A sprint of `minutes`, from now: one under way starts again. */
  startSprint(minutes: SprintMinutes): void {
    this.#sprintOn = startSprint(this.#now(), minutes);
    keep(SPRINT_KEY, this.#sprintOn);
    this.#tick();
  }

  /** The sprint stops, and leaves the colophon. */
  stopSprint(): void {
    this.#sprintOn = null;
    keep(SPRINT_KEY, null);
    this.#tick();
  }

  /** Stop the clocks and stop listening: the vault is closing. */
  stop(): void {
    clearInterval(this.#ticking);
    clearTimeout(this.#midnight);
    globalThis.removeEventListener?.('storage', this.#heard);
  }

  /** What another window here kept: today's tally, or the sprint. */
  readonly #heard = (event: StorageEvent): void => {
    if (event.key === TALLY_KEY) {
      this.#tally = readTally(kept(TALLY_KEY));
      this.#showToday();
    } else if (event.key === SPRINT_KEY) {
      this.#sprintOn = readSprint(kept(SPRINT_KEY));
      this.#tick();
    }
  };

  /** Today's words; at midnight, shown again (a new day starts at none). */
  #showToday(): void {
    const now = new Date(this.#now());
    this.#today.textContent = `Today ${signed(todayWords(this.#tally, now))}`;
    clearTimeout(this.#midnight);
    this.#midnight = setTimeout(() => this.#showToday(), untilMidnight(now) + 1000);
  }

  /** Each second while a sprint runs: its time left; at its end, once, the news. */
  #tick(): void {
    clearInterval(this.#ticking);
    this.#showSprint();
    if (!this.#sprintOn || sprintLeft(this.#sprintOn, this.#now()) === 0) return;
    this.#ticking = setInterval(() => {
      const sprint = this.#sprintOn;
      this.#showSprint();
      if (sprint && sprintLeft(sprint, this.#now()) === 0) {
        clearInterval(this.#ticking);
        // The words typed up to the end are the sprint's: counted now, not after a pause.
        this.#parts.flushWriting?.();
        const words = this.#sprintOn?.words ?? sprint.words;
        this.#showSprint();
        this.#parts.tell(`The sprint is over: ${signed(words)} words.`);
      }
    }, 1000);
  }

  #showSprint(): void {
    const sprint = this.#sprintOn;
    if (!sprint) {
      this.#sprint.textContent = '';
      return;
    }
    const left = sprintLeft(sprint, this.#now());
    this.#sprint.textContent =
      left > 0
        ? `Sprint ${clock(left)} ${signed(sprint.words)}`
        : `Sprint done ${signed(sprint.words)}`;
  }
}
