// A · Band: the approved mockup carried forward. The page's controls sit in
// its band, which hides to a lip (#16); the panes' chevrons at their heads;
// on a phone, the page's tools in the top bar. Styles in ./band.css.

import { CHEVRONS, FOOT, type LayoutSpec, VIEWS } from './layout-spec';

export const BAND: LayoutSpec = {
  desktop: [
    { name: 'band-views', slot: 'pageBar', label: 'View', items: [VIEWS] },
    {
      name: 'band-tools',
      slot: 'pageBar',
      label: 'Page',
      items: ['compare', 'seal', 'versions', '|', 'focus', 'strip'],
    },
    ...CHEVRONS,
    FOOT,
  ],
  phone: {
    name: 'phone-band',
    slot: 'phoneBar',
    label: 'Page',
    items: ['view.next', 'focus', 'more'],
  },
};
