// Before any vault is open: one sheet, one choice.

import { h, wordButton } from '../dom';

export function renderWelcome(container: HTMLElement, choose: () => void): void {
  container.replaceChildren(
    h(
      'section',
      { class: 'welcome' },
      h(
        'article',
        { class: 'welcome__sheet' },
        h('span', { class: 'seal welcome__seal', text: '永', attrs: { 'aria-hidden': 'true' } }),
        h('h1', { class: 'welcome__name', text: 'Eien' }),
        h('p', {
          class: 'welcome__lede',
          text: 'Choose a folder to keep your notes in. Every note is a plain Markdown file in it; Eien adds nothing else you can see.',
        }),
        wordButton('Choose a folder…', choose, { 'aria-keyshortcuts': 'Meta+O Control+O' }),
      ),
    ),
  );
}
