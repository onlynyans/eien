// Cleaned nodes (core/html/clean.ts) as the tests read them.

import type { CleanElement, CleanNode } from '../../src/core/html';

/** Cleaned nodes written back as tags, so a test reads what would be drawn; a part as `{part}`. */
export function shown(nodes: readonly CleanNode[]): string {
  return nodes
    .map((node) => {
      if (node.kind === 'text') return node.text;
      const attrs = Object.entries(node.attrs)
        .map(([name, value]) => ` ${name}="${value}"`)
        .join('');
      const part = node.part ? ` {${node.part}}` : '';
      return `<${node.name}${attrs}${part}>${shown(node.children)}</${node.name}>`;
    })
    .join('');
}

/** Every element of `nodes`, at any depth. */
export function* elements(nodes: readonly CleanNode[]): Generator<CleanElement> {
  for (const node of nodes) {
    if (node.kind === 'element') {
      yield node;
      yield* elements(node.children);
    }
  }
}
