// A · Band: the approved mockup carried forward. The page's controls sit in
// its band, which hides to a lip (#16); the panes' chevrons at their heads;
// on a phone, the page's tools in the top bar. Styles in ./band.css.

import { CHEVRONS, FOOT, formatBar, type LayoutSpec, VIEWS } from './layout-spec';

export const BAND: LayoutSpec = {
  desktop: [
    { name: 'band-views', slot: 'pageBar', label: 'Views', items: [VIEWS] },
    {
      name: 'band-tools',
      slot: 'pageBar',
      label: 'Page',
      items: ['compare', 'seal', 'versions', '|', 'format-bar', 'focus', 'strip'],
    },
    formatBar('band-format'),
    ...CHEVRONS,
    FOOT,
  ],
  tags: 'runningHead',
  tools: 'band-tools',
  phone: {
    name: 'phone-band',
    slot: 'phoneBar',
    label: 'Page',
    items: ['view.next', 'focus', 'more'],
  },
};
