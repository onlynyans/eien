// A short date for a list row: "16:40" today, "yesterday", "Oct 12" this
// year, "Oct 12, 2025" before. In the system's own language and clock.

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Making a formatter is slow; a list of thousands of rows needs only four. */
const formatters = new Map<string, Intl.DateTimeFormat | Intl.RelativeTimeFormat>();
function formatter<T extends Intl.DateTimeFormat | Intl.RelativeTimeFormat>(
  key: string,
  make: () => T,
): T {
  let made = formatters.get(key);
  if (!made) {
    made = make();
    formatters.set(key, made);
  }
  return made as T;
}

export function when(ms: number, now: Date = new Date(), locale?: string): string {
  const date = new Date(ms);
  const at = (kind: string) => `${kind}|${locale ?? ''}`;
  if (sameDay(date, now)) {
    return formatter(
      at('time'),
      () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    ).format(date);
  }
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(date, yesterday)) {
    return formatter(
      at('relative'),
      () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
    ).format(-1, 'day');
  }
  return date.getFullYear() === now.getFullYear()
    ? formatter(
        at('date'),
        () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
      ).format(date)
    : formatter(
        at('year'),
        () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }),
      ).format(date);
}
