// Quotation marks (spec §4, §8): curly or straight, as the vault's setting
// says. A straight quote becomes an opening or closing curly one by what's
// around it; an apostrophe is always the closing single mark, in a word
// ("don't"), before a year ("the '90s") or in an elision ("'tis",
// "rock 'n' roll"). Curly quotes become straight ones back, so a text without
// curly quotes comes back as it was.

export type QuoteStyle = 'curly' | 'straight';

const OPEN_DOUBLE = '“';
const CLOSE_DOUBLE = '”';
const OPEN_SINGLE = '‘';
const CLOSE_SINGLE = '’'; // also the apostrophe

/**
 * What a quote right after it opens: nothing (a line's start), a space, an
 * opening bracket or another opening quote.
 */
const OPENS_AFTER = /[\s([{<“‘"']$/u;

/**
 * After a dash or a slash, a quote opens only when words follow it: "She
 * stopped—"No."" opens, "I was going to—" he said" closes.
 */
const DASH_BEFORE = /[—–\-/]$/u;
const WORDS_AFTER = /^[\p{L}\p{N}“‘"'([]/u;

/**
 * HTML that starts a line or a paragraph (<br>, <p>, </p>…), marks aside: a quote after it opens.
 * One mark at a time: a run of them repeated (`(?:[*_~=]+)*`) could be split so many ways that
 * failing took time exponential in the marks (Copy as HTML keeps 64 characters before a quote).
 */
const BREAK_BEFORE =
  /<\/?(?:br|hr|p|div|blockquote|h[1-6]|li|ul|ol)\b[^<>]*>(?:[*_~=]|<[A-Za-z][A-Za-z0-9]*\b[^<>]*>)*$/iu;

/** How much of the text before a quote decides it. */
export const CONTEXT = 16;

/** Marks before a quote that don't decide it: emphasis marks, an opening tag (*"Hi,"*, <u>"Hi"</u>); one mark at a time, as above. */
const MARKS_BEFORE = /(?:[*_~=]|<[A-Za-z][A-Za-z0-9]*\b[^<>]*>)+$/u;

/** Words that start with an elided letter: 'tis, 'twas, 'em… (an apostrophe, never an open quote). */
const ELISION = /^(?:tis|twas|til|twere|twill|em|cause|bout|round|n|nother|kay|sup|cept|s)\b/iu;

/**
 * The curly mark for a straight `quote` typed or found right after `before`
 * (the text up to it) and before `after` (the text from just past it).
 */
export function curlyQuote(quote: '"' | "'", before: string, after: string): string {
  const lead = before.replace(MARKS_BEFORE, '');
  const opens =
    lead === '' ||
    BREAK_BEFORE.test(before) ||
    OPENS_AFTER.test(lead) ||
    (DASH_BEFORE.test(lead) && WORDS_AFTER.test(after));
  if (quote === '"') return opens ? OPEN_DOUBLE : CLOSE_DOUBLE;
  // An apostrophe: in a word ("don't"), before a year ("'90s"), in an elision ("'tis").
  if (!opens || /^\d/u.test(after) || ELISION.test(after)) return CLOSE_SINGLE;
  return OPEN_SINGLE;
}

/**
 * `text` with its straight quotes curled, each by what's around it; `before`
 * is the text just before it (a run of words between two marks of a note).
 */
export function curlyQuotes(text: string, before = ''): string {
  const out: string[] = [];
  // The last few characters, kept apart: slicing the end of a growing string costs its whole length.
  let prior = before.slice(-CONTEXT);
  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;
    const mark =
      char === '"' || char === "'" ? curlyQuote(char, prior, text.slice(i + 1, i + 12)) : char;
    out.push(mark);
    prior = prior.length >= CONTEXT * 4 ? (prior + mark).slice(-CONTEXT) : prior + mark;
  }
  return out.join('');
}

/**
 * Typing `next` after `before`: a quote in `before` that what follows it
 * now shows was curled the wrong way — an opening single quote that is an
 * apostrophe, before a year ("‘9" → "’9") or in an elision ("‘tis " →
 * "’tis "), or a quote closed after a dash that words now follow ("—”N" →
 * "—“N"). Where it is and the mark it should be; null when none is.
 */
export function revisedQuote(before: string, next: string): { at: number; mark: string } | null {
  const last = before.length - 1;
  if (/^\d/u.test(next) && before.endsWith(OPEN_SINGLE)) return { at: last, mark: CLOSE_SINGLE };
  if (WORDS_AFTER.test(next) && /[—–\-/][”’]$/u.test(before)) {
    return { at: last, mark: before.endsWith(CLOSE_DOUBLE) ? OPEN_DOUBLE : OPEN_SINGLE };
  }
  if (/^[\p{L}\p{N}]/u.test(next)) return null; // the word isn't over yet
  const word = /‘(\p{L}+)$/u.exec(before);
  return word && ELISION.test(word[1] + next) ? { at: word.index, mark: CLOSE_SINGLE } : null;
}

/** `text` with its curly quotes made straight (low and reversed ones too). */
export function straightQuotes(text: string): string {
  return text.replace(/[“”„‟]/gu, '"').replace(/[‘’‚‛]/gu, "'");
}

/** `text` with its quotes as `style` asks. */
export const withQuotes = (text: string, style: QuoteStyle): string =>
  style === 'curly' ? curlyQuotes(text) : straightQuotes(text);
