// When a seal was made, as the panel and the colophon say it: "just now",
// "12m ago", "2h ago", then the date ("Oct 12", "Oct 12, 2025").

import { when } from '../list/when';

const MINUTE = 60_000;

export function sealedWhen(at: number, now: number, locale?: string): string {
  const minutes = Math.floor((now - at) / MINUTE);
  if (minutes < 1) return 'just now'; // and a seal from a clock ahead of this one
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;
  return when(at, new Date(now), locale);
}

/** A local day, "2026-10-20": seals are thinned by the writer's own days. */
export function localDay(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
