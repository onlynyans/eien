// Which brackets are links. The parser reads every "[words]" as a link, but
// CommonMark makes one only with an address ("[words](…)") or a defined
// reference ("[words][ref]" and "[ref]: …" somewhere). "[sic]", "[...]" and
// "[redacted]" are the writer's own brackets, and stay text.

import type { SyntaxNode, Tree } from '@lezer/common';

type Slice = (from: number, to: number) => string;

/** A reference label as CommonMark matches it: case and runs of spaces aside. */
const labelKey = (label: string): string =>
  label.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');

/** Blocks that can hold a reference definition; nothing else is looked inside. */
const CONTAINERS = new Set(['Document', 'Blockquote', 'BulletList', 'OrderedList', 'ListItem']);

/** The labels the text defines ("[label]: address"). */
export function referenceLabels(tree: Tree, slice: Slice): Set<string> {
  const labels = new Set<string>();
  tree.iterate({
    enter(node) {
      if (node.name === 'LinkReference') {
        const label = node.node.getChild('LinkLabel');
        if (label) labels.add(labelKey(slice(label.from + 1, label.to - 1)));
        return false;
      }
      return CONTAINERS.has(node.name);
    },
  });
  return labels;
}

/** Whether a Link or Image node is one: it has an address, or names a defined reference. */
export function isLink(node: SyntaxNode, slice: Slice, references: ReadonlySet<string>): boolean {
  if (node.getChild('URL')) return true;
  const label = node.getChild('LinkLabel');
  if (label) return references.has(labelKey(slice(label.from + 1, label.to - 1)));
  // "[words]" or "[words][]": the words are the label.
  const marks = node.getChildren('LinkMark');
  const open = marks[0];
  const close = marks[1];
  if (!open || !close) return false;
  return references.has(labelKey(slice(open.to, close.from)));
}
