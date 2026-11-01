// C · Running head: one 40px strip across the window, the traffic lights in
// it, holding the panes' toggles, the breadcrumb (already in the strip) and
// every page tool, always in sight (#1); on a phone, a rail of tools at the
// page's foot. Styles in ./runhead.css.

import { FOOT, formatBar, type LayoutSpec, TOOL_FOLDS, VIEWS } from './layout-spec';

export const RUNHEAD: LayoutSpec = {
  desktop: [
    {
      name: 'runhead-panes',
      slot: 'top',
      label: 'Panes',
      items: ['pane.sidebar', 'pane.list'],
      first: true,
    },
    {
      name: 'runhead-tools',
      slot: 'top',
      label: 'Page',
      items: [
        VIEWS,
        'compare',
        'seal',
        'versions',
        '|',
        'format-bar',
        'focus',
        'bookmark',
        '|',
        'look',
      ],
      folds: TOOL_FOLDS,
    },
    formatBar('runhead-format'),
    FOOT,
  ],
  tags: 'colophon',
  tools: 'runhead-tools',
  phone: {
    name: 'phone-rail',
    slot: 'phoneFoot',
    label: 'Page',
    items: [VIEWS, '|', 'focus', 'seal', 'bookmark', 'look', 'more'],
  },
};
