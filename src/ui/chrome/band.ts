// A · Band: the approved mockup carried forward. The page's controls sit in
// its band, which hides to a lip (#16); the panes' chevrons at their heads;
// on a phone, the page's tools in the top bar. Styles in ./band.css.

import {
  BOOK_VIEWS,
  CHEVRONS,
  FOOT,
  FORMAT_FOLDS,
  formatBar,
  type LayoutSpec,
  TOOL_FOLDS,
  VIEWS,
} from './layout-spec';

export const BAND: LayoutSpec = {
  desktop: [
    { name: 'band-views', slot: 'pageBar', label: 'Views', items: [VIEWS], folds: TOOL_FOLDS },
    {
      name: 'band-tools',
      slot: 'pageBar',
      label: 'Page',
      items: [
        'compare',
        'seal',
        'versions',
        '|',
        'format-bar',
        'focus',
        'bookmark',
        '|',
        'look',
        'strip',
      ],
      folds: TOOL_FOLDS,
    },
    { ...formatBar('band-format'), folds: FORMAT_FOLDS }, // a row across the page: it folds
    ...CHEVRONS,
    FOOT,
  ],
  tags: 'runningHead',
  tools: 'band-tools',
  phone: {
    name: 'phone-band',
    slot: 'phoneBar',
    label: 'Page',
    // A note's views as one button, a book's two; each set aside with the other kind in front.
    items: ['view.next', BOOK_VIEWS, 'focus', 'bookmark', 'look', 'more'],
  },
};
