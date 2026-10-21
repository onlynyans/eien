// Where a note's front matter ends. Only located here, not parsed: the
// block is the writer's, kept byte for byte (spec §2).

/**
 * The index just past the front matter block ("---" on the first line, up
 * to the next line that is exactly "---" or "..."), or 0 when there is none.
 * Expects editor text ("\n" line endings).
 */
export function frontMatterEnd(text: string): number {
  if (!text.startsWith('---\n')) return 0;
  const close = /^(?:---|\.\.\.)[ \t]*$/m;
  const rest = text.slice(4);
  const match = close.exec(rest);
  if (!match) return 0;
  const end = 4 + match.index + match[0].length;
  return text[end] === '\n' ? end + 1 : end;
}

/**
 * The front matter's YAML (between the "---" lines, without them) and where
 * the text after it starts; null when there's none. Expects editor text.
 */
export function frontMatterBlock(
  text: string,
): { readonly yaml: string; readonly end: number } | null {
  const end = frontMatterEnd(text);
  if (end === 0) return null;
  const yaml = text.slice(4, end).replace(/(?:^|\n)(?:---|\.\.\.)[ \t]*\n?$/, '');
  return { yaml, end };
}
