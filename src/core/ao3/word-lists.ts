// Word's lists, as Word copies them: not <ul> and <li>, but paragraphs
// styled "mso-list: l0 level1 lfo1", each with its bullet or number written
// out in a span styled "mso-list: Ignore". Those paragraphs become a list's
// items, numbered or not as their written marks were, and the written marks
// go: the list marks them again.

import { declarations } from './css';
import type { HtmlElement, HtmlNode } from './html';
import { textOf } from './html-inline';

const msoList = (node: HtmlNode): string | undefined =>
  node.kind === 'element' ? declarations(node.attrs.style ?? '').get('mso-list') : undefined;

/** `nodes` without Word's written marks, and what those marks said. */
function withoutMarks(nodes: readonly HtmlNode[]): { words: HtmlNode[]; mark: string } {
  let mark = '';
  const strip = (list: readonly HtmlNode[]): HtmlNode[] =>
    list.flatMap((node): HtmlNode[] => {
      if (node.kind === 'text') return [node];
      if (msoList(node) === 'ignore') {
        mark += textOf(node.children);
        return [];
      }
      return [{ ...node, children: strip(node.children) }];
    });
  return { words: strip(nodes), mark };
}

/** `nodes` with each run of Word's list paragraphs as a list. */
export function wordLists(nodes: readonly HtmlNode[]): HtmlNode[] {
  const out: HtmlNode[] = [];
  let list = null as HtmlElement | null;
  for (const node of nodes) {
    const mso = msoList(node);
    if (node.kind === 'element' && node.name === 'p' && mso && mso !== 'ignore') {
      const { words, mark } = withoutMarks(node.children);
      const number = /^\s*([\p{N}]{1,9}|[a-z]{1,4})[.)]/iu.exec(mark);
      const name = number ? 'ol' : 'ul';
      if (list?.name !== name) {
        const start: Record<string, string> =
          number?.[1] && /^\d+$/u.test(number[1]) ? { start: number[1] } : {};
        list = { kind: 'element', name, attrs: start, children: [] };
        out.push(list);
      }
      list.children.push({ kind: 'element', name: 'li', attrs: {}, children: words });
    } else if (list && node.kind === 'text' && !node.text.trim()) {
      // The line ends between Word's paragraphs: the list goes on.
    } else {
      list = null;
      out.push(node.kind === 'element' ? { ...node, children: wordLists(node.children) } : node);
    }
  }
  return out;
}
