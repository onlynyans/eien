// The settings the reader offers (spec §14): Eien's own, from its one schema,
// the ones that change how a page reads. The rest are the app's.

import type { SettingKey } from '../../core/config';

export const READER_SETTINGS = [
  'appearance.palette',
  'appearance.scheme',
  'appearance.face',
  'appearance.textSize',
  'appearance.density',
  'appearance.frame',
  'books.numerals',
] as const satisfies readonly SettingKey[];
