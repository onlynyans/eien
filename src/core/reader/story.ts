// A story as the reader shows it (spec §14): what a site's page holds of a
// work, read off the page by the content script and handed to the reader's
// own page. Its HTML is the site's, as written; the reader only ever shows it
// cleaned (./clean.ts). What comes in a message is checked here first.

import { READER_SITES, type SiteId } from './sites';

export interface StoryChapter {
  /** From 1, as the site numbers it. */
  readonly number: number;
  /** The chapter's own title; empty when it has none. */
  readonly title: string;
  /** The site's HTML; each empty when the chapter has none. */
  readonly summary: string;
  readonly notes: string;
  readonly body: string;
  readonly endNotes: string;
}

/** A line of what a site says about a work: "Rating", ["Teen And Up Audiences"]. */
export interface StoryFact {
  readonly label: string;
  readonly values: readonly string[];
}

export interface Story {
  readonly site: SiteId;
  /** The work on its site, the same for each of its chapters: "ao3:12345". */
  readonly id: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly fandoms: readonly string[];
  /** The work's own, in the site's HTML; empty when the page doesn't show them. */
  readonly summary: string;
  readonly notes: string;
  readonly endNotes: string;
  readonly facts: readonly StoryFact[];
  /** The chapters the page shows: one, or the whole work. */
  readonly chapters: readonly StoryChapter[];
  /** How many the work has, or null when the site doesn't know yet (AO3's "?"). */
  readonly chapterCount: number | null;
  /** Whether the site has a chapter before and after these. */
  readonly previous: boolean;
  readonly next: boolean;
}

/** Bounds on what a message may hold: a page can be hostile, and the reader's page is the extension's. */
const SHORT = 2_000;
const LONG = 64 * 1024 * 1024;
const MANY = 5_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, most = SHORT): string | null =>
  typeof value === 'string' && value.length <= most ? value : null;

const texts = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length > MANY) return null;
  const all = value.map((each) => text(each));
  return all.every((each): each is string => each !== null) ? all : null;
};

const whole = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1_000_000
    ? value
    : null;

function factOf(value: unknown): StoryFact | null {
  if (!isRecord(value)) return null;
  const label = text(value.label);
  const values = texts(value.values);
  return label === null || values === null ? null : { label, values };
}

function chapterOf(value: unknown): StoryChapter | null {
  if (!isRecord(value)) return null;
  const number = whole(value.number);
  const title = text(value.title);
  const summary = text(value.summary, LONG);
  const notes = text(value.notes, LONG);
  const body = text(value.body, LONG);
  const endNotes = text(value.endNotes, LONG);
  if (number === null || title === null || body === null) return null;
  if (summary === null || notes === null || endNotes === null) return null;
  return { number, title, summary, notes, body, endNotes };
}

function allOf<T>(value: unknown, each: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > MANY) return null;
  const all = value.map(each);
  return all.every((item): item is T => item !== null) ? all : null;
}

/** `value` as a story, or null when it isn't one: a wrong shape, a site Eien doesn't read, too much. */
export function storyOf(value: unknown): Story | null {
  if (!isRecord(value)) return null;
  const site = value.site;
  if (typeof site !== 'string' || !Object.hasOwn(READER_SITES, site)) return null;
  const id = text(value.id);
  const title = text(value.title);
  const authors = texts(value.authors);
  const fandoms = texts(value.fandoms);
  const summary = text(value.summary, LONG);
  const notes = text(value.notes, LONG);
  const endNotes = text(value.endNotes, LONG);
  const facts = allOf(value.facts, factOf);
  const chapters = allOf(value.chapters, chapterOf);
  const count = value.chapterCount === null ? null : whole(value.chapterCount);
  if (id === null || !id.startsWith(`${site}:`) || title === null) return null;
  if (authors === null || fandoms === null || facts === null) return null;
  if (summary === null || notes === null || endNotes === null) return null;
  if (chapters === null || chapters.length === 0) return null;
  if (count === null && value.chapterCount !== null) return null;
  if (typeof value.previous !== 'boolean' || typeof value.next !== 'boolean') return null;
  return {
    site: site as SiteId,
    id,
    title,
    authors,
    fandoms,
    summary,
    notes,
    endNotes,
    facts,
    chapters,
    chapterCount: count,
    previous: value.previous,
    next: value.next,
  };
}
