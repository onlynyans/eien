// Fenced code, as CommonMark has it, for what reads Markdown line by line
// before the parser does (reading in runs, footnotes): a fence of three or
// more backticks or tildes; a backtick fence's line holds no other backtick;
// it closes on the same mark, at least as long, with nothing after it.

/** The fence `line` opens code with ("```", "~~~~"), or null. */
export function fenceOf(line: string): string | null {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
  if (!match) return null;
  const fence = match[1] as string;
  return fence.startsWith('`') && (match[2] as string).includes('`') ? null : fence;
}

/** Whether `line` closes code `fence` opened. */
export function closesFence(line: string, fence: string): boolean {
  const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/u.exec(line)?.[1];
  return closing !== undefined && closing[0] === fence[0] && closing.length >= fence.length;
}
