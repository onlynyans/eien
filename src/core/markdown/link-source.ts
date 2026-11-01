// A link written as Markdown (backlog #38): where a link goes, typed, says
// what kind it is. An address makes `[words](address)`; a note's name makes
// `[[note|words]]`, or `[[note]]` when the words are its name.

/**
 * A scheme ("https://", "mailto:"), "www.", or a bare site with a path or
 * none ("example.org/a"). A colon alone isn't one: "Re: the gate" is a name.
 */
const SCHEME = /^(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|tel:)\S/i;
const BARE = /^(?:www\.\S+|[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}(?:[/?#]\S*)?)$/i;

/** Whether `typed` reads as an address rather than a note's name. */
export const isAddress = (typed: string): boolean => {
  const text = typed.trim();
  return SCHEME.test(text) || (!/\s/.test(text) && BARE.test(text));
};

/** An address as a browser would take it: a bare site is the web's ("example.org" → "https://example.org"). */
export const asAddress = (typed: string): string => {
  const text = typed.trim();
  return SCHEME.test(text) ? text : `https://${text}`;
};

/**
 * What a wiki link can hold: its parser (./extensions.ts) ends it at the
 * first "]]" and refuses a "[" or a line break, and "|" parts the name from
 * the words. Those go; runs of space are one.
 */
const wikiSafe = (text: string, keepBar: boolean): string =>
  text
    .replace(keepBar ? /[[\]\n\r]/g : /[[\]|\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** `[[note]]`, or `[[note|words]]` when the words aren't the note's name. */
export function wikiLink(note: string, words: string): string {
  const name = wikiSafe(note, false);
  const said = wikiSafe(words, true);
  return said === '' || said === name ? `[[${name}]]` : `[[${name}|${said}]]`;
}

/**
 * A link's words with every bracket not already escaped escaped, and a
 * backslash at their end doubled, so nothing ends the link early or escapes
 * its closing bracket.
 */
export const linkWords = (words: string): string =>
  words
    .replace(/\r?\n/g, ' ')
    .replace(/(\\*)([[\]])/g, (whole, slashes: string, bracket: string) =>
      slashes.length % 2 === 1 ? whole : `${slashes}\\${bracket}`,
    )
    .replace(/(?<!\\)((?:\\\\)*\\)$/, '$1\\');

/** An address as a link's destination: in <…> when it holds a space or a bracket, as CommonMark asks. */
export function linkAddress(address: string): string {
  const text = address.trim();
  if (!/[\s()<>]/.test(text)) return text;
  return `<${text.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\r?\n/g, ' ')}>`;
}

/** `[words](address)`, the words the address when there are none, so the link never vanishes. */
export const webLink = (words: string, address: string): string => {
  const said = words.trim() === '' ? address.trim() : words;
  return `[${linkWords(said)}](${linkAddress(address)})`;
};

/** A wiki link's inside ("note|words") as its note's name and its words (the name, with no "|"). */
export function wikiParts(inside: string): { readonly note: string; readonly words: string } {
  const bar = inside.indexOf('|');
  if (bar === -1) return { note: inside, words: inside };
  return { note: inside.slice(0, bar), words: inside.slice(bar + 1) };
}
