// B · Slip: the page loses its band. Its tools float on a raised slip that
// folds away (#16); the panes have tabs at their edges; on a phone, a slip
// floats at the page's foot. Styles in ./slip.css.

import { CHEVRONS, FOOT, formatBar, type LayoutSpec, VIEWS } from './layout-spec';

export const SLIP: LayoutSpec = {
  desktop: [
    {
      name: 'slip',
      slot: 'pageBar',
      label: 'Page',
      items: [VIEWS, 'compare', 'seal', 'versions', 'format-bar', 'focus', 'strip'],
    },
    formatBar('slip-format'),
    ...CHEVRONS,
    FOOT,
  ],
  tags: 'underTitle',
  pager: { slot: 'pageBar', before: 'slip' },
  phone: { name: 'phone-slip', slot: 'phoneFoot', label: 'Page', items: [VIEWS, 'focus', 'more'] },
};
