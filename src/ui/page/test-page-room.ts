// A page the DOM tests hold, as the window would measure it for Page
// width's room (./page-room.ts): happy-dom lays nothing out.

/**
 * A page `page` px wide inside its 24px gutters, whose sheet at Wide would be `wide` px (or as
 * `wide` measures the ruler laid, a spread's two pages say).
 */
export function pageOf(
  page: number,
  wide: number | ((ruler: HTMLElement) => number),
  kind = '',
): HTMLElement {
  const leaf = document.body.appendChild(document.createElement('div'));
  leaf.className = `page__leaf ${kind}`;
  const scroll = leaf.appendChild(document.createElement('div'));
  scroll.className = 'page__scroll';
  scroll.style.padding = '0 24px';
  Object.defineProperty(scroll, 'clientWidth', { value: page + 48 });
  const append = scroll.append.bind(scroll);
  scroll.append = (...nodes: (Node | string)[]) => {
    for (const node of nodes)
      if (node instanceof HTMLElement && node.classList.contains('page-ruler'))
        node.getBoundingClientRect = () =>
          ({ width: Math.min(typeof wide === 'number' ? wide : wide(node), page) }) as DOMRect;
    append(...nodes);
  };
  return scroll;
}
