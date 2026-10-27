// What the content script and the story page say to each other (spec §14).
// The story page asks for the story once it's listening, and the content script
// sends it. The story page can only ask to turn a chapter or to show the site's
// own page: it never names an address, so nothing it's shown can send the tab
// anywhere but the work's own chapters.

import { type Story, storyOf } from './story';

export type Turn =
  | { readonly to: 'previous' | 'next' | 'original' }
  | { readonly to: 'chapter'; readonly number: number };

/** What the extension's popup asks the page's content script: the story shown, or to read it. */
export type ToPage = { readonly eien: 'which' } | { readonly eien: 'open' };
/** The content script's answer: the story's title, or null where the page shows none. */
export type PageAnswer = { readonly title: string } | null;

export type ToStory = { readonly eien: 'story'; readonly story: Story };
export type FromStory = { readonly eien: 'ready' } | ({ readonly eien: 'turn' } & Turn);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** The story in a message to the story page, or null when it isn't one. */
export function storyMessage(data: unknown): Story | null {
  return isRecord(data) && data.eien === 'story' ? storyOf(data.story) : null;
}

/** What the story page asked for, or null when `data` isn't a message of the story page's. */
export function storyAsk(data: unknown): FromStory | null {
  if (!isRecord(data)) return null;
  if (data.eien === 'ready') return { eien: 'ready' };
  if (data.eien !== 'turn') return null;
  if (data.to === 'previous' || data.to === 'next' || data.to === 'original') {
    return { eien: 'turn', to: data.to };
  }
  const number = data.number;
  if (
    data.to === 'chapter' &&
    typeof number === 'number' &&
    Number.isInteger(number) &&
    number >= 1
  ) {
    return { eien: 'turn', to: 'chapter', number };
  }
  return null;
}

/** What the popup asked of the page, or null when `data` isn't the popup's. */
export function pageMessage(data: unknown): ToPage | null {
  if (!isRecord(data)) return null;
  return data.eien === 'which' || data.eien === 'open' ? { eien: data.eien } : null;
}

/** The page's answer to the popup, or null when it has no story (or didn't answer as one). */
export function pageAnswer(data: unknown): PageAnswer {
  return isRecord(data) && typeof data.title === 'string' ? { title: data.title } : null;
}
