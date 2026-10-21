// Tags made with the sidebar's + (backlog #4), before any note carries them:
// tags are found in notes, so a tag with none lives in ".eien/tags.json",
// kept with the vault so every device shows it. The file's other fields
// (the tag tree's own order, later) are kept as they are.

import { withoutBom } from '../text';
import { tagKey, tidyTag, uniqueTags } from './tags';

interface TagsFile {
  made?: unknown;
  [other: string]: unknown;
}

function readFile(text: string | null): TagsFile | null {
  if (!text) return {};
  try {
    const data: unknown = JSON.parse(withoutBom(text));
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as TagsFile)
      : null;
  } catch {
    return null;
  }
}

const madeOf = (file: TagsFile): string[] =>
  Array.isArray(file.made)
    ? uniqueTags(file.made.flatMap((tag) => (typeof tag === 'string' ? (tidyTag(tag) ?? []) : [])))
    : [];

/** The tags made in the file's text; none for no file or one that can't be read. */
export const parseMadeTags = (text: string | null): string[] => madeOf(readFile(text) ?? {});

/**
 * The file's text with `tag` made (added last) or not (taken out, case aside):
 * undefined when nothing changes, null when the file isn't JSON to change.
 */
export function withMadeTag(
  text: string | null,
  tag: string,
  made: boolean,
): string | null | undefined {
  const file = readFile(text);
  if (file === null) return null;
  const before = madeOf(file);
  const rest = before.filter((one) => tagKey(one) !== tagKey(tag));
  const after = made ? [...rest, tag] : rest;
  if (after.length === before.length && after.every((one, i) => one === before[i]))
    return undefined;
  return `${JSON.stringify({ ...file, made: after }, null, 2)}\n`;
}

/** The tag typed in the sidebar's field ("#draft", "fic/aot"); null when it can't be one. */
export const typedTag = (typed: string): string | null => tidyTag(typed.trim());
