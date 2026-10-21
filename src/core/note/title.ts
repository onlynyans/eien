// A note shown under its title: one whose writing opens with a "# Title"
// heading of the same words needn't show the title twice (spec §4).

import { frontMatterEnd } from '../text';

/** Whether the writing (after any front matter, a seal's id) opens with `title` as a heading. */
export function opensWithTitle(text: string, title: string): boolean {
  const writing = text.slice(frontMatterEnd(text)).trimStart();
  const first = /^\s*#[ \t]+(.+?)[ \t#]*$/m.exec(writing.split('\n', 1)[0] ?? '');
  return first?.[1]?.trim().toLocaleLowerCase() === title.trim().toLocaleLowerCase();
}
