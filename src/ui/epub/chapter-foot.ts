// A chapter's foot (#40, Phase 2; Scroll 1, "A chapter a sheet"): after the
// chapter, on the same sheet, the chapters before and after it in the
// reading order, each a word button named for it; at the last, "The end".
// Nothing moves on until one is pressed: a chapter's end is a place to stop.
// The look is the sheet's turns (../page/page.css), as the extension's story
// page has them.

import { chapterBeside, chapterTitle, type Epub } from '../../core/epub';
import { h } from '../dom';
import { icon } from '../icons';

/** The foot of the spine item `index` of `epub`; `go` draws another. */
export function chapterFoot(epub: Epub, index: number, go: (index: number) => void): HTMLElement {
  const turn = (step: 1 | -1) => {
    const to = chapterBeside(epub.spine, index, step);
    if (to === null) return null;
    const word = step === 1 ? 'Next' : 'Previous';
    const title = chapterTitle(epub.contents, to) ?? `${word} chapter`;
    return h(
      'button',
      {
        class: 'word-button sheet__turn',
        attrs: {
          type: 'button',
          'data-turn': step === 1 ? 'next' : 'previous',
          'aria-label': title === `${word} chapter` ? title : `${word} chapter: ${title}`,
        },
        on: { click: () => go(to) },
      },
      step === -1 ? icon('left') : null,
      title,
      step === 1 ? icon('right') : null,
    );
  };
  return h(
    'nav',
    { class: 'sheet__turns', attrs: { 'aria-label': 'Chapters' } },
    turn(-1),
    turn(1) ?? h('span', { class: 'label sheet__end', text: 'The end' }),
  );
}
