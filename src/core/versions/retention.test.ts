import { describe, expect, it } from 'vitest';
import { sealsToThin } from './retention';
import { parseVersionFile, type VersionFile, versionFileName } from './version-files';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 20, 12, 0, 0);
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** The day in a zone `hours` from UTC, as a writer there counts days. */
const zoneDay = (hours: number) => (ms: number) => utcDay(ms + hours * 60 * 60 * 1000);

const seal = (ms: number, name: string | null = null, count = 1): VersionFile =>
  parseVersionFile(versionFileName(ms, name, count)) as VersionFile;
const files = (versions: VersionFile[]) => versions.map((v) => v.file).sort();

describe('sealsToThin', () => {
  it('keeps every seal of the last 30 days', () => {
    const recent = [seal(now - DAY), seal(now - DAY + 1000), seal(now - 30 * DAY + 1000)];
    expect(sealsToThin(recent, now, utcDay)).toEqual([]);
  });

  it('thins an older day to its last seal', () => {
    const day = now - 40 * DAY;
    const morning = seal(day);
    const noon = seal(day + 3 * 60 * 60 * 1000);
    const evening = seal(day + 6 * 60 * 60 * 1000);
    const latest = seal(now - DAY);
    expect(files(sealsToThin([morning, noon, evening, latest], now, utcDay))).toEqual(
      files([morning, noon]),
    );
  });

  it('never thins a named seal, or the latest seal, however old', () => {
    const day = now - 400 * DAY;
    const named = seal(day, 'before the rewrite');
    const a = seal(day + 1000);
    const b = seal(day + 2000);
    expect(files(sealsToThin([named, a, b], now, utcDay))).toEqual(files([a]));
    const onlyOld = [seal(day), seal(day + 1000)];
    expect(sealsToThin(onlyOld, now, utcDay)).toEqual([onlyOld[0]]);
  });

  it('counts a second seal in the same second as the later one', () => {
    const day = now - 40 * DAY;
    const first = seal(day, null, 1);
    const second = seal(day, null, 2);
    expect(sealsToThin([second, first, seal(now)], now, utcDay)).toEqual([first]);
  });

  it('thins by the writer’s own day: midnight in their time zone, not UTC', () => {
    // 23:30 and 00:30 UTC on either side of midnight: one day in Tokyo (UTC+9), two in UTC.
    const before = Date.UTC(2026, 6, 1, 23, 30);
    const after = Date.UTC(2026, 6, 2, 0, 30);
    const versions = [seal(before), seal(after), seal(now)];
    expect(sealsToThin(versions, now, utcDay)).toEqual([]);
    expect(sealsToThin(versions, now, zoneDay(9))).toEqual([versions[0]]);
  });

  it('keeps one a day across a month’s end and a year’s', () => {
    const versions = [
      seal(Date.UTC(2025, 11, 31, 10)),
      seal(Date.UTC(2025, 11, 31, 20)),
      seal(Date.UTC(2026, 0, 1, 1)),
      seal(Date.UTC(2026, 1, 28, 9)),
      seal(Date.UTC(2026, 1, 28, 10)),
      seal(Date.UTC(2026, 2, 1, 0)),
      seal(now),
    ];
    const [lastYear, , , february] = versions as [
      VersionFile,
      VersionFile,
      VersionFile,
      VersionFile,
    ];
    expect(files(sealsToThin(versions, now, utcDay))).toEqual(files([lastYear, february]));
  });

  it('takes the 30 days to the millisecond: exactly 30 days old is kept', () => {
    const edge = [seal(now - 30 * DAY), seal(now - 30 * DAY), seal(now)];
    expect(sealsToThin(edge, now, utcDay)).toEqual([]);
  });

  it('thins nothing from none, or from one', () => {
    expect(sealsToThin([], now, utcDay)).toEqual([]);
    expect(sealsToThin([seal(now - 999 * DAY)], now, utcDay)).toEqual([]);
  });
});
