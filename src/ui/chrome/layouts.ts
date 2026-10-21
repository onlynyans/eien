// The three layouts by name: the one place that knows them all.

import { BAND } from './band';
import type { Layout } from './commands';
import type { LayoutSpec } from './layout-spec';
import { RUNHEAD } from './runhead';
import { SLIP } from './slip';

export const LAYOUT_SPECS: Readonly<Record<Layout, LayoutSpec>> = {
  band: BAND,
  slip: SLIP,
  runhead: RUNHEAD,
};
