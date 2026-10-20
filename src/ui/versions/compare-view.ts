// What Compare shows in the editor's place (spec §9), read only: the draft
// against a seal, word by word — removed words struck through, added ones
// underlined — or the seal alone. A line across the top says which, and
// typing returns to the draft, the key landing there.

import { readNote } from '../../core/note';
import { type DiffRun, diffCounts, diffLines, wordDiff } from '../../core/versions';
import { h } from '../dom';

/** What a seal is called in the line across the top: "“before the rewrite” · sealed 2h ago". */
export interface SealLabel {
  readonly name: string | null;
  /** "2h ago", "Oct 12". */
  readonly when: string;
}

const plainOf = (text: string) => readNote(text, '').plain;
const count = (n: number) => n.toLocaleString();

/** A line across the top of the sheet: what it's showing, and a legend or a hint. */
const stateLine = (kind: string, ...parts: (Node | string)[]) =>
  h('div', { class: `sheet__state sheet__state--${kind}`, attrs: { role: 'status' } }, ...parts);

/** A run as written; a changed one marked, the space after it left outside the mark. */
function runEls(run: DiffRun): (Node | string)[] {
  if (run.kind === 'same') return [run.text];
  const words = run.text.trimEnd();
  const space = run.text.slice(words.length);
  return [h(run.kind === 'added' ? 'ins' : 'del', { class: 'diff', text: words }), space];
}

/** Lines of runs as paragraphs. */
function prose(lines: readonly (readonly DiffRun[])[], label: string): HTMLElement {
  return h(
    'div',
    { class: 'compare', attrs: { tabindex: '0', 'aria-label': label, 'aria-readonly': 'true' } },
    ...lines.map((line) => h('p', {}, ...line.flatMap(runEls))),
  );
}

/**
 * The view, built for one showing. `draft` is called with a typed key (or
 * none): the writer wants the draft back.
 */
export function compareView(
  showing:
    | { readonly kind: 'changes'; readonly seal: string; readonly draft: string }
    | { readonly kind: 'sealed'; readonly seal: string },
  label: SealLabel,
  draft: (key: string | null) => void,
): HTMLElement {
  const called = label.name
    ? [h('strong', { text: `“${label.name}”` }), ` · sealed ${label.when}`]
    : [`the seal ${label.when}`];
  let line: HTMLElement;
  let body: HTMLElement;
  if (showing.kind === 'changes') {
    const ops = wordDiff(plainOf(showing.seal), plainOf(showing.draft));
    const { removed, added } = diffCounts(ops);
    line = stateLine(
      'changes',
      h('span', {}, 'Changes since ', ...called),
      h(
        'span',
        { class: 'legend' },
        removed ? h('del', { text: `${count(removed)} removed` }) : null,
        removed && added ? ' ' : null,
        added ? h('ins', { text: `${count(added)} added` }) : null,
        removed || added ? null : 'No changes',
        h('span', { class: 'sep', text: ' · ', attrs: { 'aria-hidden': 'true' } }),
        'Read only',
      ),
    );
    body = prose(diffLines(ops), 'Changes, read only');
  } else {
    const lines = plainOf(showing.seal)
      .split('\n')
      .filter((text) => text.trim())
      .map((text): DiffRun[] => [{ kind: 'same', text: text.trim() }]);
    line = stateLine(
      'sealed',
      h(
        'span',
        {},
        ...(label.name ? [`“${label.name}” · `] : []),
        `Sealed ${label.when} — read only`,
      ),
      h('span', {}, 'Type to return to the draft'),
    );
    body = prose(lines, 'Sealed text, read only');
  }
  body.addEventListener('keydown', (event) => {
    const typed = event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (!typed && event.key !== 'Enter' && event.key !== 'Escape') return;
    event.preventDefault();
    draft(typed ? event.key : null);
  });
  return h('div', { class: 'compare-view' }, line, body);
}
