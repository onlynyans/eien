// Building the window's DOM: one small helper instead of a framework.

type Child = Node | string | null | undefined | false;

export interface Props {
  class?: string;
  text?: string;
  /** Attributes set as written (aria-*, data-*, role, type, …). */
  attrs?: Record<string, string | boolean | undefined>;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (event: HTMLElementEventMap[K]) => void }>;
}

/** An element with its class, text, attributes, listeners and children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.class) element.className = props.class;
  if (props.text !== undefined) element.textContent = props.text;
  for (const [name, value] of Object.entries(props.attrs ?? {})) {
    if (value === true) element.setAttribute(name, '');
    else if (typeof value === 'string') element.setAttribute(name, value);
  }
  for (const [type, listener] of Object.entries(props.on ?? {})) {
    element.addEventListener(type, listener as EventListener);
  }
  element.append(...children.filter((child): child is Node | string => Boolean(child)));
  return element;
}

/** A word-button: a control that is a word, not an icon (docs/design). */
export const wordButton = (label: string, onClick: () => void, attrs: Props['attrs'] = {}) =>
  h('button', {
    class: 'word-button',
    text: label,
    attrs: { type: 'button', ...attrs },
    on: { click: onClick },
  });
