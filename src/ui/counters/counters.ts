// The colophon's counters (spec §4): today's words on this device, the
// book's words against its goal, and a sprint's time left and words gained.
// Today's tally and a sprint under way are this device's, kept in the
// window's own storage (spec §2), so a restart keeps them. A sprint ends
// quietly: the colophon says so, and one line of news (spec §1).

import {
  clock,
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
} from '../../core/counters';
import { h } from '../dom';

const TALLY_KEY = 'eien.today';
const SPRINT_KEY = 'eien.sprint';

/** A book's words, the open note's live, and its goal. */
export interface BookShown {
  readonly words: number;
  readonly goal?: number;
}

export interface CountersParts {
  /** One line of news: a sprint is over. */
  tell(message: string): void;
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

  constructor(parts: CountersParts) {
    this.#parts = parts;
    this.element = h('span', { class: 'counters' }, this.#today, this.#book, this.#sprint);
    this.#showToday();
    this.#tick();
  }

  #now(): number {
    return this.#parts.now?.() ?? Date.now();
  }

  /** Words written (or, below 0, cut) by the writer, here. */
  wrote(added: number): void {
    this.#tally = tallied(this.#tally, new Date(this.#now()), added);
    keep(TALLY_KEY, this.#tally);
    this.#showToday();
    const sprint = this.#sprintOn;
    if (sprint && sprintLeft(sprint, this.#now()) > 0) {
      this.#sprintOn = { ...sprint, words: sprint.words + added };
      keep(SPRINT_KEY, this.#sprintOn);
      this.#showSprint();
    }
  }

  /** The open note's book, or none. */
  showBook(book: BookShown | null): void {
    this.#book.textContent = book
      ? `Book ${book.words.toLocaleString('en')}${book.goal ? ` / ${book.goal.toLocaleString('en')}` : ''}`
      : '';
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

  /** Stop the clock: the vault is closing. */
  stop(): void {
    clearInterval(this.#ticking);
  }

  #showToday(): void {
    this.#today.textContent = `Today ${signed(todayWords(this.#tally, new Date(this.#now())))}`;
  }

  /** Each second while a sprint runs: its time left; at its end, once, the news. */
  #tick(): void {
    clearInterval(this.#ticking);
    this.#showSprint();
    if (!this.#sprintOn || sprintLeft(this.#sprintOn, this.#now()) === 0) return;
    this.#ticking = setInterval(() => {
      const sprint = this.#sprintOn;
      this.#showSprint();
      this.#showToday(); // midnight passes in a sprint too
      if (sprint && sprintLeft(sprint, this.#now()) === 0) {
        clearInterval(this.#ticking);
        this.#parts.tell(`The sprint is over: ${signed(sprint.words)} words.`);
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
