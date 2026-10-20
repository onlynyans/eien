// Before any vault is open: one sheet, one choice. On the desktop, the
// writer chooses a folder; on Android the vault has its one place, and the
// sheet says why Eien asks for the access it needs there (spec §10).

import { h, wordButton } from '../dom';

const DESKTOP = {
  lede: 'Choose a folder to keep your notes in. Every note is a plain Markdown file in it; Eien adds nothing else you can see.',
  choice: 'Choose a folder…',
};

/** Where the vault has one place, the words for it, by platform. */
const PHONE: Record<string, typeof DESKTOP> = {
  android: {
    lede: 'Eien keeps your notes in Documents/Eien, where Syncthing can sync them with your other devices. Every note is a plain Markdown file. Android asks once to let Eien use the files there.',
    choice: 'Allow file access…',
  },
};

export function renderWelcome(container: HTMLElement, choose: () => void, platform = ''): void {
  const words = PHONE[platform] ?? DESKTOP;
  container.replaceChildren(
    h(
      'section',
      { class: 'welcome' },
      h(
        'article',
        { class: 'welcome__sheet' },
        h('span', { class: 'seal welcome__seal', text: '永', attrs: { 'aria-hidden': 'true' } }),
        h('h1', { class: 'welcome__name', text: 'Eien' }),
        h('p', { class: 'welcome__lede', text: words.lede }),
        wordButton(words.choice, choose, { 'aria-keyshortcuts': 'Meta+O Control+O' }),
      ),
    ),
  );
}
