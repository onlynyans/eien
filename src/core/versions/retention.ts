// Which seals go (spec §9): named seals are kept until deleted; unnamed
// ones older than 30 days are thinned to one a day, the day's last; and
// the latest seal is always kept. What goes, goes to the system's trash.

import type { VersionFile } from './version-files';

const DAY = 24 * 60 * 60 * 1000;

/** How long every seal is kept. */
export const KEEP_EVERY_SEAL_DAYS = 30;

/**
 * The seals among `versions` to thin at `now`. `dayOf` names the writer's
 * day for a moment (their own time zone), so "one a day" is their day.
 */
export function sealsToThin(
  versions: readonly VersionFile[],
  now: number,
  dayOf: (at: number) => string,
): VersionFile[] {
  const cutoff = now - KEEP_EVERY_SEAL_DAYS * DAY;
  const latest = versions.reduce<VersionFile | null>(
    (newest, v) =>
      !newest || v.at > newest.at || (v.at === newest.at && v.count > newest.count) ? v : newest,
    null,
  );
  /** Each old day's last unnamed seal: the one that day keeps. */
  const kept = new Map<string, VersionFile>();
  for (const v of versions) {
    if (v.name !== null || v.at >= cutoff) continue;
    const day = dayOf(v.at);
    const best = kept.get(day);
    if (!best || v.at > best.at || (v.at === best.at && v.count > best.count)) kept.set(day, v);
  }
  return versions.filter(
    (v) => v.name === null && v.at < cutoff && v !== latest && kept.get(dayOf(v.at)) !== v,
  );
}
