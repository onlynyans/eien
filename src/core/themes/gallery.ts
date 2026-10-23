// Eien's own themes (spec §7): the gallery. Each is paper, dye, ink and one
// seal, keeping Eien's order of surfaces and its contrast by day and by
// night. Paper is tokens.css's own colours and Slate has its sheet
// (slate.css): both are listed here for their cards and their verdict, and
// worn by their sheets. The rest are worn as token overrides.

import { statusInksFor } from './mix';
import type { DayNight, Palette, PaletteColor, STATUS_INKS } from './palette';

export interface GalleryTheme {
  /** The palette setting's value. */
  readonly id: string;
  readonly name: string;
  /** What it is, in a line. */
  readonly note: string;
  readonly palette: Palette;
  /** Worn by a style sheet of its own (tokens.css, slate.css), not by overrides. */
  readonly inSheet?: true;
}

type StatusInk = (typeof STATUS_INKS)[number];

/** A theme's colours as written: the status inks, when left out, are fitted to its surfaces. */
type Colors = Record<Exclude<PaletteColor, StatusInk>, DayNight> &
  Partial<Record<StatusInk, DayNight>>;

const palette = (colors: Colors): Palette => ({ ...statusInksFor(colors), ...colors });

const theme = (
  id: string,
  name: string,
  note: string,
  colors: Colors,
  inSheet?: true,
): GalleryTheme => ({
  id,
  name,
  note,
  palette: palette(colors),
  ...(inSheet ? { inSheet } : {}),
});

export const GALLERY: readonly GalleryTheme[] = [
  theme(
    'paper',
    'Paper',
    'The default: off-white paper and black ink',
    {
      desk: ['#d9d2c8', '#110e0b'],
      blotter: ['#eae5dd', '#1a1713'],
      band: ['#f4f1ea', '#201d19'],
      paper: ['#fdfbf7', '#28241f'],
      selected: ['#ede9e3', '#38332e'],
      ink: ['#23201c', '#e9e2d4'],
      'ink-soft': ['#51473c', '#c3b9a7'],
      pencil: ['#5d5348', '#a7a095'],
      faded: ['#766d62', '#837c73'],
      seal: ['#c4472d', '#e0603f'],
      added: ['#485c2c', '#9cb880'],
      removed: ['#93304a', '#e98aa0'],
      caution: ['#6b501f', '#d0a659'],
    },
    true,
  ),
  theme('linen', 'Linen', 'Warmer, yellow-tinted paper with an orange accent', {
    desk: ['#d8cfb8', '#14110a'],
    blotter: ['#e9e2cd', '#1c180f'],
    band: ['#f3eedd', '#231e14'],
    paper: ['#fcf9ee', '#2b251a'],
    selected: ['#ece5d1', '#3b3426'],
    ink: ['#2a2418', '#ece3cc'],
    'ink-soft': ['#574a33', '#c8bb9c'],
    pencil: ['#5f523d', '#ab9f86'],
    faded: ['#7b6d56', '#88806d'],
    seal: ['#b8432a', '#dc6a43'],
  }),
  theme('indigo', 'Indigo', 'Cool paper with blue-black text', {
    desk: ['#c9cfd8', '#0b0e14'],
    blotter: ['#dfe3e9', '#121620'],
    band: ['#edf0f4', '#181d28'],
    paper: ['#fbfcfd', '#1f2533'],
    selected: ['#e3e8ef', '#2e3648'],
    ink: ['#17213a', '#dde4f0'],
    'ink-soft': ['#34405c', '#b3bfd6'],
    pencil: ['#3f4b64', '#97a3ba'],
    faded: ['#5f6a80', '#7a8599'],
    seal: ['#c4472d', '#e3664a'],
  }),
  theme('moss', 'Moss', 'Green-grey background with softer text', {
    desk: ['#cdd2c4', '#0d100b'],
    blotter: ['#e1e5d9', '#141811'],
    band: ['#eef0e8', '#1a1f16'],
    paper: ['#fafbf6', '#21271c'],
    selected: ['#e5e9dc', '#30382a'],
    ink: ['#1f2619', '#e2e8d6'],
    'ink-soft': ['#3e4833', '#bcc6ab'],
    pencil: ['#48523c', '#a0aa90'],
    faded: ['#67705a', '#808a72'],
    seal: ['#a8432f', '#d76a4e'],
  }),
  theme('candlelight', 'Candlelight', 'Amber tones with no blue light at night', {
    desk: ['#dccab2', '#120c06'],
    blotter: ['#ecdfcb', '#1b130b'],
    band: ['#f5ece0', '#22180e'],
    paper: ['#fdf8f0', '#2a1f13'],
    selected: ['#efe3d1', '#3c2d1e'],
    ink: ['#2b1d10', '#f0dcc0'],
    'ink-soft': ['#5a4129', '#d2b894'],
    pencil: ['#634d37', '#b39b7c'],
    faded: ['#7f6a53', '#8f7c64'],
    seal: ['#b9442b', '#e8763f'],
  }),
  theme('ink', 'Ink', 'Highest contrast, for easier reading', {
    desk: ['#cfcfcc', '#000000'],
    blotter: ['#e6e6e3', '#0a0a0a'],
    band: ['#f2f2ef', '#141414'],
    paper: ['#ffffff', '#1b1b1b'],
    selected: ['#e8e8e4', '#2c2c2c'],
    ink: ['#000000', '#f5f5f2'],
    'ink-soft': ['#262626', '#d9d9d4'],
    pencil: ['#3a3a3a', '#bdbdb8'],
    faded: ['#5e5e5e', '#8f8f8a'],
    seal: ['#c4361d', '#ff6a45'],
  }),
  theme('blossom', 'Blossom', 'Pink-grey tones with plum text and a rose accent', {
    desk: ['#d8cdcc', '#120d0e'],
    blotter: ['#e9e1e0', '#1b1415'],
    band: ['#f3eeed', '#221a1b'],
    paper: ['#fdfafa', '#2a2122'],
    selected: ['#eee6e5', '#3a2f30'],
    ink: ['#2a1e20', '#efe1e2'],
    'ink-soft': ['#573f43', '#cbb5b8'],
    pencil: ['#5f464a', '#ad989b'],
    faded: ['#7c6468', '#8d7b7d'],
    seal: ['#b2394a', '#e0697a'],
  }),
  theme(
    'slate',
    'Slate',
    'Cool grey around warm paper, with a burnt-orange accent',
    {
      desk: ['#cfd4d2', '#0c0f0e'],
      blotter: ['#e4e8e7', '#141817'],
      band: ['#f3f2ed', '#1f1e1a'],
      paper: ['#fbfaf6', '#272521'],
      selected: ['#e8eae7', '#353733'],
      ink: ['#191a16', '#ecebe7'],
      'ink-soft': ['#292620', '#d9d7d2'],
      pencil: ['#525752', '#9aa09b'],
      faded: ['#6d716e', '#808581'],
      seal: ['#aa5910', '#d58042'],
      added: ['#246135', '#6fb880'],
      removed: ['#932c21', '#e68677'],
      caution: ['#694e00', '#d5b36a'],
    },
    true,
  ),
];

/** The gallery's theme `id`, if it is one. */
export const galleryTheme = (id: string): GalleryTheme | undefined =>
  GALLERY.find((each) => each.id === id);

/** The theme worn when the chosen one can't be: Eien's own. */
export const PAPER = GALLERY[0] as GalleryTheme;
