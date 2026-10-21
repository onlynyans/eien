// The palette's choices for the writer's own themes (spec §7), after the
// gallery's: one per file in .eien/themes, drawn again as the files change.
// Settings' Themes tabs (Gallery and Custom) will take this row's place.

import { mineChoice } from '../../core/themes';
import { h, wordButton } from '../dom';
import type { WriterThemes } from '../theme/writer-themes';

export interface MineChoices {
  /** The writer's themes, as buttons, inside the palette's group. */
  readonly element: HTMLElement;
  /** Mark the one worn, given the palette's value. */
  show(value: string): void;
}

export function mineChoices(themes: WriterThemes, choose: (value: string) => void): MineChoices {
  const element = h('span', { class: 'setting__mine' });
  let shown = '';
  const mark = () => {
    for (const button of element.querySelectorAll<HTMLButtonElement>('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.value === shown));
    }
  };
  const draw = () => {
    element.replaceChildren(
      ...themes.list.map((theme) => {
        const value = mineChoice(theme.title);
        // A name the writer typed, in the text face, as a note's title is.
        return wordButton(theme.title, () => choose(value), {
          'data-value': value,
          class: 'word-button setting__own',
        });
      }),
    );
    mark();
  };
  themes.onChange(draw);
  draw();
  return {
    element,
    show(value) {
      shown = value;
      mark();
    },
  };
}
