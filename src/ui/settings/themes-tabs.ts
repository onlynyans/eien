// Settings / Themes (themes.md): two tabs. Gallery, Eien's own themes;
// Custom, the writer's own, one named file each in .eien/themes, plus a
// card that makes a new one. Choosing a card wears it on the whole window at
// once; the custom theme worn opens its mix below the cards.

import { nameKey } from '../../core/paths';
import { FIRST_MIX, GALLERY, mineChoice, themeChoice } from '../../core/themes';
import { h } from '../dom';
import { icon } from '../icons';
import { reasonOf } from '../reason';
import type { WriterThemes } from '../theme/writer-themes';
import { MixPanel } from './mix-panel';
import type { SettingsState } from './settings-state';
import { markWorn, themeCard } from './theme-card';

export interface ThemesTab {
  readonly element: HTMLElement;
  /** Mark the theme worn, given the palette's value. */
  show(palette: string): void;
  /** Write what's waiting to be written: Settings is closing. */
  flush(): Promise<void>;
}

type Choose = (value: string) => void;

const about = (text: string) => h('p', { class: 'setting__about themes__about', text });

export function galleryTab(choose: Choose): ThemesTab {
  const cards = GALLERY.map((theme) =>
    themeCard({ ...theme, value: theme.id }, () => choose(theme.id)),
  );
  return {
    element: h(
      'div',
      { class: 'themes' },
      about('Built-in themes. Each has a light and a dark version with readable contrast.'),
      h(
        'div',
        { class: 'themes__cards', attrs: { role: 'group', 'aria-label': 'Gallery' } },
        ...cards,
      ),
    ),
    show: (palette) => markWorn(cards, palette),
    flush: async () => {},
  };
}

export function customTab(
  themes: WriterThemes,
  settings: SettingsState,
  choose: Choose,
): ThemesTab {
  const said = h('p', { class: 'mix__said', attrs: { role: 'status' } });
  const say = (words: string) => {
    said.textContent = words;
  };
  const panel = new MixPanel({ themes, say });
  const cards = h('div', {
    class: 'themes__cards',
    attrs: { role: 'group', 'aria-label': 'Custom' },
  });
  const make = h(
    'button',
    { class: 'theme theme--new', attrs: { type: 'button' }, on: { click: () => void makeOne() } },
    icon('plus'),
    h('span', { class: 'theme__name', text: 'New theme' }),
    h('span', { class: 'label theme__note', text: 'Mixed from four choices' }),
  );
  let worn = settings.values['appearance.palette'];

  const makeOne = async () => {
    try {
      const made = await themes.create('Untitled', FIRST_MIX);
      if (!('title' in made)) return say('A new theme couldn’t be named: every Untitled is taken.');
      choose(mineChoice(made.title));
      say(`Made ${made.path}`);
      draw();
      panel.nameFirst();
    } catch (error) {
      say(reasonOf(error));
    }
  };

  /** The cards, and the mix of the one worn: drawn again as the files or the choice change. */
  const draw = () => {
    // A card with the keyboard is drawn again: the keyboard stays on it.
    const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.theme');
    const refocus = focused && cards.contains(focused) ? (focused.dataset.value ?? 'new') : null;
    cards.replaceChildren(
      ...themes.list.map((theme) =>
        themeCard(
          {
            name: theme.title,
            note: theme.mix ? 'Your own' : 'Can’t be read',
            palette: theme.mix ? themes.palette(theme.mix) : null,
            value: mineChoice(theme.title),
          },
          () => choose(mineChoice(theme.title)),
        ),
      ),
      make,
    );
    const drawn = [...cards.querySelectorAll<HTMLElement>('.theme[data-value]')];
    markWorn(drawn, worn);
    if (refocus) (drawn.find((card) => card.dataset.value === refocus) ?? make).focus();
    const choice = themeChoice(worn);
    const open =
      choice.kind === 'mine'
        ? themes.list.find((theme) => nameKey(theme.title) === nameKey(choice.title))
        : undefined;
    if (open) panel.show(open);
    else if (!panel.renaming) {
      void panel.flush();
      panel.element.remove();
      return;
    }
    if (open && !panel.element.isConnected) element.insertBefore(panel.element, said);
  };

  const element = h(
    'div',
    { class: 'themes' },
    about(
      'Themes you’ve created. Each is saved as a file in .eien/themes and syncs with the vault to every device. Select one to use and edit it, or create a new one.',
    ),
    cards,
    said,
  );
  themes.onChange(draw);
  draw();
  return {
    element,
    show(palette) {
      if (palette === worn) return;
      worn = palette;
      draw();
    },
    flush: () => panel.flush(),
  };
}
