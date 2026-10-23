// What's typed or pasted into a table's cell, as it's saved (spec §4,
// Tables): a cell is one line, so pasted lines join with spaces; and a pipe
// would end the cell, so a "|" is written "\|", unless the writer already
// escaped it. A backslash typed just before a cell's edge is doubled, or it
// would take the edge for its own.

/** How many backslashes `text` ends with. */
const trailingSlashes = (text: string) => text.length - text.replace(/\\+$/u, '').length;

/** Every pipe in `text` escaped, but one after an odd run of backslashes, which already is. */
export const escapePipes = (text: string): string =>
  text.replace(/(\\*)\|/gu, (pipe, slashes: string) =>
    slashes.length % 2 ? pipe : `${slashes}\\|`,
  );

/** Lines joined into one, with a space where each break was. */
export const oneLine = (text: string): string => text.replace(/[ \t]*\r?\n\s*/gu, ' ');

/**
 * `typed`, put into a cell between `before` and `after` (the rest of its
 * line), as it's saved: one line, and no pipe that splits a cell where there
 * was none. The cells either side stay as they were.
 */
export function cellInput(before: string, typed: string, after: string): string {
  const run = trailingSlashes(before);
  let out = escapePipes('\\'.repeat(run) + oneLine(typed)).slice(run);
  // A pipe right after: escaped or not as it was before, whatever backslashes came in front of it.
  if (/^\\*\|/u.test(after) && trailingSlashes(before + out) % 2 !== run % 2) out += '\\';
  return out;
}

/** Whether `typed` could change a cell's edges: a pipe, a backslash or a line break in it. */
export const mayCrossCells = (typed: string): boolean => /[|\\\n]/u.test(typed);
