export { AO3 } from './ao3';
export { FFN } from './ffn';
export type { Found, Site } from './site';

import { AO3 } from './ao3';
import { FFN } from './ffn';
import type { Site } from './site';

/** Every site the extension reads, as core/extension/sites.ts lists them. */
export const SITES: readonly Site[] = [AO3, FFN];

/** The site whose page `at` is, if the extension reads it. */
export const siteFor = (at: URL): Site | undefined => SITES.find((site) => site.holds(at));
