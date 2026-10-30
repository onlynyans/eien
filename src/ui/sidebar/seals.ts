// The sidebar's seal, twice: at its head it shuts the sidebar to a strip,
// and on the strip it opens it again. One shows at a time, so the one that
// had the keyboard hands it to the other.

import { h } from '../dom';

export function seals(keys: string, toggle: () => void): { show: HTMLElement; hide: HTMLElement } {
  const seal = (label: string, extra: string) =>
    h(
      'button',
      {
        class: `seal-button ${extra}`,
        attrs: { type: 'button', 'aria-label': label, title: `${label} (${keys})` },
        on: {
          click: () => {
            const had = document.activeElement === (extra === 'sidebar__show' ? show : hide);
            toggle();
            // The seal that had the keyboard is hidden now: the other one, in its place, takes it.
            if (had) (extra === 'sidebar__show' ? hide : show).focus();
          },
        },
      },
      h('span', { class: 'seal', text: '永', attrs: { 'aria-hidden': 'true' } }),
    );
  const show = seal('Show sidebar', 'sidebar__show');
  const hide = seal('Hide sidebar', 'sidebar__hide');
  return { show, hide };
}
