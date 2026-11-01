// The CSS Custom Highlight API stood in for the DOM tests (#40, Phase 5),
// as happy-dom has neither it nor StaticRange: a registry of Highlights by
// name, each a set of ranges, and the words each name inks now.

import { afterEach, beforeEach } from 'vitest';

/** A static range as the window's own keeps one: where it starts and ends. */
class TestStaticRange {
  readonly startContainer: Node;
  readonly startOffset: number;
  readonly endContainer: Node;
  readonly endOffset: number;
  constructor(init: StaticRangeInit) {
    this.startContainer = init.startContainer;
    this.startOffset = init.startOffset;
    this.endContainer = init.endContainer;
    this.endOffset = init.endOffset;
  }
}

class TestHighlight extends Set<AbstractRange> {}

const registry = new Map<string, TestHighlight>();

/** The ranges the ink `name` covers now, as live ranges, in the order they were added. */
export const inkRanges = (name: string): Range[] =>
  [...(registry.get(name) ?? [])].map((range) => {
    const live = document.createRange();
    live.setStart(range.startContainer, range.startOffset);
    live.setEnd(range.endContainer, range.endOffset);
    return live;
  });

/** The words the ink `name` covers now, range by range, in the order they were added. */
export const inked = (name: string): string[] => inkRanges(name).map((range) => range.toString());

/** How many ranges the ink `name` holds now, every page's. */
export const inkCount = (name: string): number => registry.get(name)?.size ?? 0;

/** The API in place for each test of the file that calls it, and taken away after. */
export function withInk(): void {
  const scope = globalThis as unknown as Record<string, unknown>;
  beforeEach(() => {
    registry.clear();
    // The window's CSS is a getter (a new one each time): an own one of the test's stands over it.
    Object.defineProperty(globalThis, 'CSS', {
      value: { highlights: registry },
      configurable: true,
      writable: true,
    });
    scope.Highlight = TestHighlight;
    scope.StaticRange = TestStaticRange;
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'CSS');
    Reflect.deleteProperty(scope, 'Highlight');
    Reflect.deleteProperty(scope, 'StaticRange');
  });
}
